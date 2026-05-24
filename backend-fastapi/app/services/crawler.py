from __future__ import annotations

import re
import math
from urllib.parse import urlparse, urljoin

import requests
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

from app.services.ai_cleaner import ai_cleaner


def _is_likely_detail_page(url: str) -> bool:
    try:
        pathname = urlparse(url).path.lower()
        parts = [p for p in pathname.split('/') if p]
        if len(parts) < 2:
            return False
        detail_roots = {'single', 'article', 'articles', 'blog', 'post', 'posts', 'news', 'docs'}
        if parts[0] not in detail_roots:
            return False
        slug = parts[1] if len(parts) > 1 else ''
        return len(slug) > 8 or '-' in slug or any(c.isdigit() for c in slug)
    except Exception:
        return False


def _is_crawlable_path(url: str) -> bool:
    try:
        p = urlparse(url).path.lower()
        if p.startswith('/api/'):
            return False
        if re.search(r'\.(png|jpe?g|gif|svg|webp|ico|css|js|map|json|xml|pdf|zip|woff2?|ttf|eot|otf)$', p):
            return False
        return True
    except Exception:
        return False


def _score_url_priority(url: str, inlink_count: int = 1) -> float:
    try:
        parsed = urlparse(url)
        path = parsed.path.lower()
        segments = [s for s in path.split('/') if s]
        depth_penalty = len(segments) * 0.7
        query_penalty = 1.5 if parsed.query else 0.0
        detail_penalty = 3.0 if _is_likely_detail_page(url) else 0.0
        slug_penalty = 1.0 if any(len(s) > 24 or s.count('-') >= 3 for s in segments) else 0.0
        root_boost = 1.5 if path in ('', '/') else 0.0
        inlink_boost = min(3.0, math.log2(max(1, inlink_count)))
        return depth_penalty + query_penalty + detail_penalty + slug_penalty - root_boost - inlink_boost
    except Exception:
        return 50.0


class CrawlerService:
    """Standard HTTP crawler using requests + BeautifulSoup.

    Thread-safe: all state is created fresh per crawl() call.
    """

    async def crawl(
        self,
        start_url: str,
        max_pages: int = 20,
        max_depth: int = 2,
        auth: dict | None = None,
        options: dict | None = None,
    ) -> list[dict]:
        opts = options or {}
        exclude_patterns: list[str] = opts.get('excludePatterns') or []
        privacy_patterns: list[str] = opts.get('privacyPatterns') or []
        use_ai: bool = opts.get('useAI') or False
        seed_urls: list[str] = opts.get('seedUrls') or []

        # Fresh state per crawl
        visited: set[str] = set()
        pages: list[dict] = []

        base_url = f"{urlparse(start_url).scheme}://{urlparse(start_url).netloc}"
        exclude_regexes = [re.compile(p, re.I) for p in exclude_patterns]
        privacy_regexes = [re.compile(p, re.I) for p in privacy_patterns]

        auth_cookies = (auth or {}).get('cookies') or {}
        cookie_header = '; '.join([f"{k}={v}" for k, v in auth_cookies.items()]) if auth_cookies else None
        headers = {
            'User-Agent': 'TicketClassifier-Crawler/1.0',
            **((auth or {}).get('headers') or {}),
        }
        if cookie_header:
            headers['Cookie'] = cookie_header

        levels: dict[int, list[str]] = {0: [start_url]}
        if seed_urls and max_depth >= 1:
            normalized_seeds = []
            for u in set(seed_urls):
                try:
                    absolute = urljoin(start_url, u).split('#')[0]
                    if absolute.startswith(base_url) and _is_crawlable_path(absolute):
                        normalized_seeds.append(absolute)
                except Exception:
                    pass
            levels[1] = normalized_seeds

        for depth in range(max_depth + 1):
            if len(pages) >= max_pages:
                break
            current_level = levels.get(depth) or []
            if not current_level:
                break

            next_level_counts: dict[str, int] = {}
            print(f"[Crawler] Processing depth {depth} ({len(current_level)} urls)")

            for url in current_level:
                if len(pages) >= max_pages:
                    break
                if url in visited:
                    continue
                if any(r.search(url) for r in exclude_regexes):
                    print(f"[Crawler] Skipping excluded URL: {url}")
                    continue

                visited.add(url)

                try:
                    print(f"[Crawler] Crawling: {url}")
                    resp = requests.get(url, headers=headers, timeout=12, allow_redirects=True)
                    final_url = resp.url
                    if not final_url.startswith(base_url):
                        print(f"Skipped (redirected outside domain): {url} -> {final_url}")
                        continue

                    soup = BeautifulSoup(resp.text, 'html.parser')
                    title = soup.title.string.strip() if soup.title and soup.title.string else url

                    for s in soup(['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe']):
                        s.decompose()

                    raw_content = re.sub(r'\s+', ' ', soup.get_text(separator=' ')).strip()

                    # Skip pages with no meaningful content
                    if len(raw_content) < 50:
                        continue

                    final_content = raw_content
                    is_private = any(r.search(url) for r in privacy_regexes)

                    if use_ai:
                        if is_private:
                            print(f"[Crawler] Privacy mode for {url}. Summarizing...")
                            final_content = await ai_cleaner.extract_knowledge_with_privacy(raw_content, url)
                        else:
                            final_content = await ai_cleaner.extract_knowledge(raw_content, url)

                    if final_content and final_content.strip():
                        pages.append({
                            'url': url,
                            'title': title,
                            'content': final_content,
                            'metadata': {'isPrivateSnippet': is_private, 'depth': depth},
                        })

                    if depth < max_depth:
                        for a in soup.find_all('a', href=True):
                            href = a.get('href', '')
                            if not href:
                                continue
                            try:
                                absolute = urljoin(url, href).split('#')[0]
                                if (
                                    absolute.startswith(base_url)
                                    and absolute not in visited
                                    and _is_crawlable_path(absolute)
                                ):
                                    next_level_counts[absolute] = next_level_counts.get(absolute, 0) + 1
                            except Exception:
                                pass
                except Exception as err:
                    print(f"Failed to crawl {url}: {err}")

            if depth < max_depth and next_level_counts:
                ranked = sorted(
                    next_level_counts.keys(),
                    key=lambda u: _score_url_priority(u, next_level_counts[u]),
                )
                levels[depth + 1] = ranked

        return pages


class AdvancedCrawler:
    """Playwright-based crawler for JavaScript-heavy websites.

    Thread-safe: all state is created fresh per crawl() call.
    """

    async def crawl(
        self,
        start_url: str,
        max_pages: int = 10,
        max_depth: int = 2,
        auth: dict | None = None,
        options: dict | None = None,
    ) -> list[dict]:
        opts = options or {}
        exclude_patterns: list[str] = opts.get('excludePatterns') or []
        privacy_patterns: list[str] = opts.get('privacyPatterns') or []
        use_ai: bool = opts.get('useAI') or False
        seed_urls: list[str] = opts.get('seedUrls') or []

        # Fresh state per crawl
        visited_urls: set[str] = set()
        pages: list[dict] = []

        exclude_regexes = [re.compile(p, re.I) for p in exclude_patterns]
        privacy_regexes = [re.compile(p, re.I) for p in privacy_patterns]

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent='TicketClassifier-AdvancedCrawler/1.0',
                extra_http_headers=(auth or {}).get('extraHTTPHeaders') or {},
                viewport={'width': 1280, 'height': 800},
            )

            # Inject cookies
            cookies = (auth or {}).get('cookies') or []
            if cookies:
                base_domain = urlparse(start_url).hostname
                cookies_with_domain = []
                for c in cookies:
                    cookies_with_domain.append({
                        **c,
                        'domain': c.get('domain') or base_domain,
                        'path': c.get('path') or '/',
                    })
                await context.add_cookies(cookies_with_domain)
                print(f"[Advanced] Injected {len(cookies_with_domain)} cookies")

            # Automated login flow
            login_flow = (auth or {}).get('loginFlow')
            if login_flow:
                login_url = login_flow.get('loginUrl')
                username = login_flow.get('username')
                password = login_flow.get('password')
                username_sel = login_flow.get('usernameSelector')
                password_sel = login_flow.get('passwordSelector')
                submit_sel = login_flow.get('submitSelector')
                wait_for_sel = login_flow.get('waitForSelector')

                print(f"[Advanced] Performing automated login at {login_url}")
                login_page = await context.new_page()
                try:
                    await login_page.goto(login_url, wait_until='networkidle', timeout=30000)
                    if not username_sel:
                        for s in ['input[type="email"]', 'input[name="email"]', 'input[name="username"]']:
                            if await login_page.query_selector(s):
                                username_sel = s
                                break
                    if not password_sel:
                        for s in ['input[type="password"]', 'input[name="password"]']:
                            if await login_page.query_selector(s):
                                password_sel = s
                                break
                    if not submit_sel:
                        for s in ['button[type="submit"]', 'button:has-text("Sign in")', 'button:has-text("Login")']:
                            if await login_page.query_selector(s):
                                submit_sel = s
                                break
                    if username_sel and password_sel and submit_sel:
                        await login_page.fill(username_sel, username)
                        await login_page.fill(password_sel, password)
                        await login_page.click(submit_sel)
                        if wait_for_sel:
                            await login_page.wait_for_selector(wait_for_sel, timeout=15000)
                        else:
                            await login_page.wait_for_load_state('networkidle')
                        print("[Advanced] Login complete")
                except Exception as err:
                    print("[Advanced] Login error:", err)
                finally:
                    await login_page.close()

            base_domain = f"{urlparse(start_url).scheme}://{urlparse(start_url).netloc}"
            levels: dict[int, list[str]] = {0: [start_url]}

            if seed_urls and max_depth >= 1:
                normalized_seeds = []
                for u in set(seed_urls):
                    try:
                        absolute = urljoin(start_url, u).split('#')[0]
                        if absolute.startswith(base_domain) and _is_crawlable_path(absolute):
                            normalized_seeds.append(absolute)
                    except Exception:
                        pass
                levels[1] = normalized_seeds

            for depth in range(max_depth + 1):
                if len(pages) >= max_pages:
                    break
                current_level = levels.get(depth) or []
                if not current_level:
                    break

                next_level_counts: dict[str, int] = {}
                print(f"[Advanced] Processing depth {depth} ({len(current_level)} urls)")

                for url in current_level:
                    if len(pages) >= max_pages:
                        break
                    if url in visited_urls:
                        continue
                    if any(r.search(url) for r in exclude_regexes):
                        print(f"[Advanced] Skipping excluded URL: {url}")
                        continue

                    print(f"[Advanced] Crawling: {url}")
                    visited_urls.add(url)

                    page = await context.new_page()
                    try:
                        await page.goto(url, wait_until='networkidle', timeout=30000)
                        await self._auto_scroll(page)
                        data = await self._extract_content(page)

                        final_content = data['content']
                        if len(final_content.strip()) < 50:
                            continue

                        is_private = any(r.search(url) for r in privacy_regexes)

                        if use_ai:
                            if is_private:
                                print(f"[Advanced] Privacy mode for {url}. Summarizing...")
                                final_content = await ai_cleaner.extract_knowledge_with_privacy(data['content'], url)
                            else:
                                final_content = await ai_cleaner.extract_knowledge(data['content'], url)

                        if final_content and final_content.strip():
                            pages.append({
                                'url': url,
                                'title': data['title'],
                                'content': final_content,
                                'metadata': {**data['metadata'], 'isPrivateSnippet': is_private, 'depth': depth},
                            })

                        if depth < max_depth:
                            links = await self._extract_links(page, base_domain)
                            for link in links:
                                if link not in visited_urls and _is_crawlable_path(link):
                                    next_level_counts[link] = next_level_counts.get(link, 0) + 1
                    except Exception as err:
                        print(f"Failed to crawl {url}: {err}")
                    finally:
                        await page.close()

                if depth < max_depth and next_level_counts:
                    ranked = sorted(
                        next_level_counts.keys(),
                        key=lambda u: _score_url_priority(u, next_level_counts[u]),
                    )
                    levels[depth + 1] = ranked

            await browser.close()

        return pages

    async def _auto_scroll(self, page) -> None:
        try:
            await page.evaluate("""async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 150;
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        if (totalHeight >= scrollHeight || totalHeight > 10000) {
                            clearInterval(timer);
                            resolve();
                        }
                    }, 80);
                });
            }""")
        except Exception:
            pass

    async def _extract_content(self, page) -> dict:
        title = await page.title()
        try:
            data = await page.evaluate("""() => {
                const selectorsToRemove = ['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe', 'noscript'];
                selectorsToRemove.forEach(s => document.querySelectorAll(s).forEach(el => el.remove()));
                // Prefer main content areas
                const main = document.querySelector('main, [role="main"], article, .content, #content, #main');
                const text = main ? main.innerText : document.body.innerText;
                return {
                    text: text.replace(/\\n{3,}/g, '\\n\\n').trim(),
                    buttons: Array.from(document.querySelectorAll('button, a.btn')).map(el => el.innerText.trim()).filter(Boolean)
                };
            }""")
        except Exception:
            data = {'text': '', 'buttons': []}

        return {
            'title': title,
            'content': data.get('text', ''),
            'metadata': {'buttons': data.get('buttons', [])[:20]},
        }

    async def _extract_links(self, page, base_domain: str) -> list[str]:
        try:
            return await page.evaluate("""(domain) => {
                const out = new Set();
                const add = (raw) => {
                    if (!raw) return;
                    const v = raw.trim();
                    if (!v || v.startsWith('#') || v.startsWith('mailto:') || v.startsWith('tel:') || v.startsWith('javascript:')) return;
                    try {
                        const href = new URL(v, location.href).href.split('#')[0];
                        if (href.startsWith(domain)) out.add(href);
                    } catch {}
                };
                document.querySelectorAll('a[href]').forEach(el => add(el.getAttribute('href')));
                document.querySelectorAll('[data-href]').forEach(el => add(el.getAttribute('data-href')));
                document.querySelectorAll('link[rel="next"], link[rel="prev"]').forEach(el => add(el.getAttribute('href')));
                return Array.from(out);
            }""", base_domain)
        except Exception:
            return []


# Singletons — no shared crawl state, safe for concurrent requests
crawler_service = CrawlerService()
advanced_crawler = AdvancedCrawler()
