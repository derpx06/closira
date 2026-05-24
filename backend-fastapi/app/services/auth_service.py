from __future__ import annotations

from uuid import uuid4
from app.core.compat import CryptContext, DuplicateKeyError
from app.db.mongo import get_db
from app.db.counters import next_sequence
from app.auth.jwt import sign_access_token
from app.schemas.auth import RegisterRequest, LoginRequest
from app.utils.permissions import default_employee_permissions

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')


def _build_user_response(user: dict, company: dict, company_role: dict | None):
    return {
        'id': user['id'],
        'name': user['fullName'],
        'email': user['email'],
        'role': user['role'],
        'companyId': user['companyId'],
        'companyUuid': company['uuid'],
        'company': {
            'uuid': company['uuid'],
            'name': company['name'],
            'countryCode': company.get('countryCode'),
            'about': company.get('about'),
            'website': company.get('website'),
            'industry': company.get('industry'),
            'phone': company.get('phone'),
        },
        'companyRole': company_role,
    }


async def register_user(body: RegisterRequest):
    db = await get_db()
    email_norm = body.email.strip().lower()
    existing = await db['users'].find_one({'email': email_norm}, {'_id': 1})
    if existing:
        return 409, {'message': 'An account with this email already exists.'}

    company_id = await next_sequence('companies')
    company_uuid = str(uuid4())
    company_name = body.companyName or f"{body.fullName.strip()}'s Organization"
    company_doc = {
        'id': company_id,
        'uuid': company_uuid,
        'name': company_name,
        'countryCode': body.countryCode,
        'about': body.companyAbout,
        'website': body.companyWebsite,
        'industry': body.companyIndustry,
        'phone': body.companyPhone,
        'adminUserId': None,
        'createdAt': __import__('datetime').datetime.utcnow(),
    }
    await db['companies'].insert_one(company_doc)

    user_id = await next_sequence('users')
    user_doc = {
        'id': user_id,
        'companyId': company_id,
        'email': email_norm,
        'passwordHash': pwd_context.hash(body.password),
        'fullName': body.fullName.strip(),
        'role': 'admin',
        'managerId': None,
        'companyRoleId': None,
        'createdAt': __import__('datetime').datetime.utcnow(),
    }

    try:
        await db['users'].insert_one(user_doc)
    except DuplicateKeyError:
        await db['companies'].delete_one({'id': company_id})
        return 409, {'message': 'An account with this email already exists.'}

    await db['companies'].update_one({'id': company_id}, {'$set': {'adminUserId': user_id}})

    existing_role = await db['company_roles'].find_one({'companyId': company_id, 'name': 'Employee'})
    if not existing_role:
        role_id = await next_sequence('company_roles')
        await db['company_roles'].insert_one({
            'id': role_id,
            'companyId': company_id,
            'name': 'Employee',
            'baseRole': 'employee',
            'description': None,
            'permissions': default_employee_permissions(),
            'createdAt': __import__('datetime').datetime.utcnow(),
        })

    token = sign_access_token(user_doc['id'], user_doc['role'], user_doc['companyId'])
    return 201, {'token': token, 'user': _build_user_response(user_doc, company_doc, None)}


async def login_user(body: LoginRequest):
    db = await get_db()
    email_norm = body.email.strip().lower()
    row = await db['users'].find_one({'email': email_norm})
    if not row or not pwd_context.verify(body.password, row['passwordHash']):
        return 401, {'message': 'Invalid email or password.'}

    company = await db['companies'].find_one({'id': row['companyId']})
    if not company:
        return 500, {'message': 'Company record not found for this user.'}

    role_doc = None
    if row.get('companyRoleId') is not None:
        role_doc = await db['company_roles'].find_one({'id': row['companyRoleId'], 'companyId': row['companyId']})

    company_role = None
    if role_doc:
        company_role = {
            'id': role_doc['id'],
            'name': role_doc['name'],
            'baseRole': role_doc['baseRole'],
            'permissions': role_doc['permissions'],
        }

    token = sign_access_token(row['id'], row['role'], row['companyId'])
    return 200, {'token': token, 'user': _build_user_response(row, company, company_role)}
