from app.db.mongo import get_db

CATEGORY_KEYWORDS = {
    'billing': ['billing', 'payment', 'invoice', 'charge', 'refund', 'subscription'],
    'technical': ['technical', 'tech', 'engineering', 'bug', 'error', 'issue', 'crash', 'outage'],
    'login': ['login', 'signin', 'sign in', 'password', 'reset', 'auth', 'access'],
    'other': ['support', 'help', 'general', 'customer'],
}


def _norm(v) -> str:
    return str(v or '').strip().lower()


def _score_role(role: dict, keywords: list[str], category: str) -> int:
    name = _norm(role.get('name'))
    description = _norm(role.get('description'))
    text = f'{name} {description}'
    score = 0
    if category and name == category:
        score += 4
    if category and category in name:
        score += 3
    if category and category in description:
        score += 2
    for kw in keywords:
        if kw in name:
            score += 2
        if kw in description:
            score += 1
    return score


import time

_role_cache: dict[str, tuple[dict, float]] = {}
CACHE_TTL = 3600  # 1 hour

async def resolve_assigned_role(company_id: int, category: str | None = None, message: str | None = None):
    cache_key = f"{company_id}:{category}:{message}"
    if cache_key in _role_cache:
        val, expiry = _role_cache[cache_key]
        if time.time() < expiry:
            return val

    db = await get_db()
    roles = await db['company_roles'].find({'companyId': company_id}).sort('name', 1).to_list(length=None)
    if not roles:
        return None

    normalized_category = _norm(category)
    message_text = _norm(message)
    keywords = set(CATEGORY_KEYWORDS.get(normalized_category, []))
    for token in message_text.split():
        if len(token) >= 4:
            keywords.add(token)

    best_role = None
    best_score = -1
    for role in roles:
        score = _score_role(role, list(keywords), normalized_category)
        if score > best_score:
            best_score = score
            best_role = role

    chosen = best_role or roles[0]
    res = {'id': chosen.get('id'), 'name': chosen.get('name')}
    _role_cache[cache_key] = (res, time.time() + CACHE_TTL)
    return res
