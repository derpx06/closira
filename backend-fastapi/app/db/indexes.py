from uuid import uuid4
from app.db.mongo import get_db
from app.utils.permissions import default_employee_permissions

_indexes_ready = False


async def ensure_indexes() -> None:
    global _indexes_ready
    if _indexes_ready:
        return

    db = await get_db()
    companies = db['companies']
    users = db['users']
    company_roles = db['company_roles']
    api_keys = db['api_keys']
    knowledge_sites = db['knowledge_sites']
    sitemaps = db['sitemaps']
    tickets = db['tickets']
    messages = db['messages']
    chat_sessions = db['chat_sessions']

    await companies.create_index('id', unique=True)
    await companies.create_index('uuid', unique=True, partialFilterExpression={'uuid': {'$type': 'string'}})

    await users.create_index('id', unique=True)
    await users.create_index('email', unique=True)
    await users.create_index('companyId')
    await users.create_index('companyRoleId')

    await company_roles.create_index('id', unique=True)
    await company_roles.create_index([('companyId', 1), ('name', 1)], unique=True)
    await company_roles.create_index('companyId')

    await api_keys.create_index('id', unique=True)
    await api_keys.create_index('key', unique=True)
    await api_keys.create_index('companyId')

    await knowledge_sites.create_index('id', unique=True)
    await knowledge_sites.create_index([('companyId', 1), ('baseUrl', 1)], unique=True)
    await knowledge_sites.create_index('companyId')

    try:
        existing = await sitemaps.index_information()
        if 'companyId_1' in existing:
            await sitemaps.drop_index('companyId_1')
    except Exception:
        pass

    await sitemaps.create_index([('companyId', 1), ('websiteId', 1)], unique=True)
    await tickets.create_index([('companyId', 1), ('createdAt', -1)])
    await tickets.create_index([('companyId', 1), ('status', 1), ('updatedAt', -1)])
    await messages.create_index([('companyId', 1), ('ticketId', 1), ('createdAt', 1)])
    await messages.create_index([('companyId', 1), ('sessionId', 1), ('createdAt', 1)])
    await chat_sessions.create_index('sessionId', unique=True)
    await chat_sessions.create_index([('companyId', 1), ('ticketId', 1)])

    missing = companies.find({'$or': [{'uuid': {'$exists': False}}, {'uuid': None}, {'uuid': ''}]}, {'id': 1})
    async for company in missing:
        await companies.update_one(
            {'id': company['id'], '$or': [{'uuid': {'$exists': False}}, {'uuid': None}, {'uuid': ''}]},
            {'$set': {'uuid': str(uuid4())}},
        )

    await company_roles.update_many(
        {'baseRole': 'manager'},
        {'$set': {'baseRole': 'employee', 'permissions': default_employee_permissions()}},
    )

    _indexes_ready = True
