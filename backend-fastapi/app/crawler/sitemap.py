from __future__ import annotations

import re
from urllib.parse import urlparse
import httpx


def _extract_locs(xml: str) -> list[str]:
    return [m.strip() for m in re.findall(r'<loc>([^<]+)</loc>', xml, flags=re.I)]


def _normalize(url: str) -> str | None:
    try:
        return url.split('#')[0].strip()
    except Exception:
        return None


def _is_sitemap_index(xml: str) -> bool:
    return bool(re.search(r'<sitemapindex[^>]*>', xml, flags=re.I))


async def fetch_sitemap_urls(base_url: str, max_urls: int = 5000, timeout_ms: int = 15000) -> dict:
    parsed = urlparse(base_url)
    origin = f'{parsed.scheme}://{parsed.netloc}'

    queue: list[str] = []
    fetched_from: list[str] = []
    visited_sitemaps: set[str] = set()
    collected: set[str] = set()

    robots_url = f'{origin}/robots.txt'
    timeout = timeout_ms / 1000.0

    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        try:
            robots = await client.get(robots_url)
            for line in robots.text.splitlines():
                line = line.strip()
                if line.lower().startswith('sitemap:'):
                    val = line.split(':', 1)[1].strip()
                    norm = _normalize(val)
                    if norm:
                        queue.append(norm)
        except Exception:
            pass

        if not queue:
            queue.append(f'{origin}/sitemap.xml')

        while queue and len(collected) < max_urls:
            sitemap_url = queue.pop(0)
            if not sitemap_url or sitemap_url in visited_sitemaps:
                continue
            visited_sitemaps.add(sitemap_url)
            fetched_from.append(sitemap_url)

            try:
                res = await client.get(sitemap_url)
                xml = res.text or ''
                locs = [u for u in (_normalize(v) for v in _extract_locs(xml)) if u]
                if _is_sitemap_index(xml):
                    for loc in locs:
                        if loc not in visited_sitemaps:
                            queue.append(loc)
                else:
                    for loc in locs:
                        if len(collected) < max_urls and loc.startswith(origin):
                            collected.add(loc)
            except Exception:
                pass

    return {'urls': list(collected), 'fetchedFrom': fetched_from}
