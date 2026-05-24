from datetime import datetime
from app.core.compat import CryptContext, DuplicateKeyError, ReturnDocument
from app.db.mongo import get_db
from app.db.counters import next_sequence
from app.utils.permissions import default_employee_permissions

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')


def _map_role(row: dict) -> dict:
    return {
        'id': row['id'],
        'name': row['name'],
        'description': row.get('description'),
        'baseRole': row['baseRole'],
        'permissions': row['permissions'],
        'createdAt': row['createdAt'],
    }


async def list_roles(company_id: int):
    db = await get_db()
    rows = await db['company_roles'].find({'companyId': company_id}).sort('name', 1).to_list(length=None)
    return {'roles': [_map_role(r) for r in rows]}


async def create_role(company_id: int, body: dict):
    db = await get_db()
    role = {
        'id': await next_sequence('company_roles'),
        'companyId': company_id,
        'name': body['name'].strip(),
        'baseRole': 'employee',
        'permissions': default_employee_permissions(),
        'description': body.get('description'),
        'createdAt': datetime.utcnow(),
    }
    try:
        await db['company_roles'].insert_one(role)
    except DuplicateKeyError:
        return 409, {'message': 'A role with this name already exists.'}
    return 201, {'role': _map_role(role)}


async def update_role(company_id: int, role_id: int, body: dict):
    db = await get_db()
    updates = {}
    if body.get('name') is not None:
        updates['name'] = str(body['name']).strip()
    if body.get('description') is not None:
        updates['description'] = body['description']
    try:
        updated = await db['company_roles'].find_one_and_update(
            {'id': role_id, 'companyId': company_id},
            {'$set': updates},
            return_document=ReturnDocument.AFTER,
        )
    except DuplicateKeyError:
        return 409, {'message': 'A role with this name already exists.'}
    if not updated:
        return 404, {'message': 'Role not found.'}
    return 200, {'role': _map_role(updated)}


async def delete_role(company_id: int, role_id: int):
    db = await get_db()
    in_use = await db['users'].count_documents({'companyId': company_id, 'companyRoleId': role_id})
    if in_use > 0:
        return 400, {'message': 'Cannot delete a role that is assigned to team members.'}
    deleted = await db['company_roles'].delete_one({'id': role_id, 'companyId': company_id})
    if deleted.deleted_count == 0:
        return 404, {'message': 'Role not found.'}
    return 204, None


async def list_members(company_id: int):
    db = await get_db()
    members = await db['users'].find({'companyId': company_id}).sort('fullName', 1).to_list(length=None)
    roles = await db['company_roles'].find({'companyId': company_id}, {'id': 1, 'name': 1, 'baseRole': 1}).to_list(length=None)
    role_by_id = {r['id']: r for r in roles}
    return {
        'members': [
            {
                'id': m['id'],
                'fullName': m['fullName'],
                'email': m['email'],
                'systemRole': m['role'],
                'companyRole': (
                    {
                        'id': role_by_id[m['companyRoleId']]['id'],
                        'name': role_by_id[m['companyRoleId']]['name'],
                        'baseRole': role_by_id[m['companyRoleId']]['baseRole'],
                    }
                    if m.get('companyRoleId') in role_by_id
                    else None
                ),
            }
            for m in members
        ]
    }


async def create_member(company_id: int, body: dict):
    db = await get_db()
    email_norm = str(body['email']).strip().lower()
    role = await db['company_roles'].find_one({'id': body['companyRoleId'], 'companyId': company_id}, {'_id': 1})
    if not role:
        return 400, {'message': 'Invalid team role for this company.'}

    user = {
        'id': await next_sequence('users'),
        'companyId': company_id,
        'email': email_norm,
        'passwordHash': pwd_context.hash(body['password']),
        'fullName': body['fullName'].strip(),
        'role': 'employee',
        'managerId': None,
        'companyRoleId': body['companyRoleId'],
        'createdAt': datetime.utcnow(),
    }
    try:
        await db['users'].insert_one(user)
    except DuplicateKeyError:
        return 409, {'message': 'A user with this email already exists.'}

    return 201, {'member': {'id': user['id'], 'fullName': user['fullName'], 'email': user['email'], 'systemRole': user['role'], 'companyRoleId': user['companyRoleId']}}


async def update_member(company_id: int, member_id: int, body: dict):
    db = await get_db()
    current = await db['users'].find_one({'id': member_id, 'companyId': company_id}, {'role': 1, 'companyRoleId': 1})
    if not current:
        return 404, {'message': 'Member not found.'}
    if current.get('role') == 'admin':
        return 400, {'message': 'Organization admins cannot be edited from Teams.'}

    final_role_id = body.get('companyRoleId', current.get('companyRoleId'))
    if body.get('companyRoleId') is not None:
        exists = await db['company_roles'].find_one({'id': body['companyRoleId'], 'companyId': company_id}, {'_id': 1})
        if not exists:
            return 400, {'message': 'Invalid team role.'}

    await db['users'].update_one({'id': member_id, 'companyId': company_id}, {'$set': {'role': 'employee', 'companyRoleId': final_role_id, 'managerId': None}})
    return 200, {'success': True}


async def delete_member(company_id: int, admin_id: int, member_id: int):
    db = await get_db()
    if member_id == admin_id:
        return 400, {'message': 'You cannot remove your own account.'}
    target = await db['users'].find_one({'id': member_id, 'companyId': company_id}, {'role': 1})
    if not target:
        return 404, {'message': 'Member not found.'}

    if target.get('role') == 'admin':
        admins = await db['users'].count_documents({'companyId': company_id, 'role': 'admin'})
        if admins <= 1:
            return 400, {'message': 'Cannot remove the only company administrator.'}

    await db['users'].delete_one({'id': member_id, 'companyId': company_id})
    return 204, None
