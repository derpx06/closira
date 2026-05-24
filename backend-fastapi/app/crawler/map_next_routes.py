from __future__ import annotations

from pathlib import Path

CODE_EXTS = {'.ts', '.tsx', '.js', '.jsx', '.mdx'}
IGNORE_DIRS = {'node_modules', '.next', '.git', 'dist', 'build', 'out', 'coverage'}


def _walk_files(root: Path) -> list[Path]:
    out: list[Path] = []
    for p in root.rglob('*'):
        if p.is_dir() and p.name in IGNORE_DIRS:
            continue
        if p.is_file() and p.suffix.lower() in CODE_EXTS:
            out.append(p)
    return out


def _norm_segments(segments: list[str]):
    params = []
    dynamic = False
    catch_all = False
    normalized = []
    for s in segments:
        if not s or s.startswith('@'):
            continue
        if s.startswith('(') and s.endswith(')'):
            continue
        if s.startswith('[...') and s.endswith(']'):
            param = s[4:-1] or 'slug'
            params.append(param)
            dynamic = True
            catch_all = True
            normalized.append(f'*{param}')
            continue
        if s.startswith('[[...') and s.endswith(']]'):
            param = s[5:-2] or 'slug'
            params.append(param)
            dynamic = True
            catch_all = True
            normalized.append(f'*{param}?')
            continue
        if s.startswith('[') and s.endswith(']'):
            param = s[1:-1] or 'id'
            params.append(param)
            dynamic = True
            normalized.append(f':{param}')
            continue
        normalized.append(s)
    return normalized, params, dynamic, catch_all


def create_route_map(project_root_input: str) -> dict:
    project_root = Path(project_root_input).resolve()
    if not project_root.exists():
        raise RuntimeError(f'Project path does not exist: {project_root}')

    app_roots = [p for p in [project_root / 'app', project_root / 'src' / 'app'] if p.exists() and p.is_dir()]
    pages_roots = [p for p in [project_root / 'pages', project_root / 'src' / 'pages'] if p.exists() and p.is_dir()]

    routes = []

    for root in app_roots:
        for f in _walk_files(root):
            rel = f.relative_to(root).as_posix()
            parts = rel.split('/')
            file_name = Path(parts[-1]).stem
            if file_name not in {'page', 'route'}:
                continue
            segments = parts[:-1]
            normalized, params, dynamic, catch_all = _norm_segments(segments)
            if file_name == 'route' and (not normalized or normalized[0] != 'api'):
                continue
            route = '/' + '/'.join(normalized) if normalized else '/'
            routes.append({
                'route': route,
                'type': 'app-api' if file_name == 'route' else 'app-page',
                'source': f.relative_to(project_root).as_posix(),
                'router': 'app',
                'dynamic': dynamic,
                'catchAll': catch_all,
                'params': params,
            })

    for root in pages_roots:
        for f in _walk_files(root):
            rel = f.relative_to(root).as_posix()
            no_ext = str(Path(rel).with_suffix('')).replace('\\', '/')
            parts = [p for p in no_ext.split('/') if p]
            if parts and parts[0] != 'api' and parts[0] in {'_app', '_document', '_error'}:
                continue
            parts = [p for p in parts if p != 'index']
            normalized, params, dynamic, catch_all = _norm_segments(parts)
            route = '/' + '/'.join(normalized) if normalized else '/'
            routes.append({
                'route': route,
                'type': 'pages-api' if (parts and parts[0] == 'api') else 'pages-page',
                'source': f.relative_to(project_root).as_posix(),
                'router': 'pages',
                'dynamic': dynamic,
                'catchAll': catch_all,
                'params': params,
            })

    routes = sorted(routes, key=lambda r: (r['route'], r['type'], r['source']))
    counts = {
        'total': len(routes),
        'appPages': len([r for r in routes if r['type'] == 'app-page']),
        'appApis': len([r for r in routes if r['type'] == 'app-api']),
        'pagesPages': len([r for r in routes if r['type'] == 'pages-page']),
        'pagesApis': len([r for r in routes if r['type'] == 'pages-api']),
        'dynamic': len([r for r in routes if r['dynamic']]),
        'catchAll': len([r for r in routes if r['catchAll']]),
    }
    return {'projectRoot': str(project_root), 'generatedAt': __import__('datetime').datetime.utcnow().isoformat(), 'counts': counts, 'routes': routes}


def summarize_route_map(route_map: dict) -> str:
    c = route_map['counts']
    total_pages = c['appPages'] + c['pagesPages']
    return f"Sitemap generated from codebase at {route_map['projectRoot']}. Total routes: {c['total']}. Page routes: {total_pages}. API routes: {c['appApis'] + c['pagesApis']}."


def route_map_to_sitemap_pages(route_map: dict, base_url: str | None = None) -> list[dict]:
    out = []
    for r in route_map['routes']:
        if r['type'] not in {'app-page', 'pages-page'}:
            continue
        route = r['route']
        url = f"{base_url.rstrip('/')}{route}" if base_url else route
        out.append({'title': route, 'url': url, 'dynamic': r['dynamic'], 'source': r['source'], 'params': r['params']})
    return out
