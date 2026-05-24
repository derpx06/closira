from fastapi import APIRouter, Depends, Response
from app.auth.dependencies import require_admin, AuthContext
from app.schemas.teams import CreateRoleRequest, UpdateRoleRequest, CreateMemberRequest, UpdateMemberRequest
from app.services.team_service import (
    list_roles,
    create_role,
    update_role,
    delete_role,
    list_members,
    create_member,
    update_member,
    delete_member,
)

from app.core.serialization import MongoFriendlyRoute

router = APIRouter(prefix='/teams', tags=['teams'], route_class=MongoFriendlyRoute)


@router.get('/roles')
async def roles(auth: AuthContext = Depends(require_admin)):
    return await list_roles(auth.company_id)


@router.post('/roles')
async def create_roles(body: CreateRoleRequest, response: Response, auth: AuthContext = Depends(require_admin)):
    status, payload = await create_role(auth.company_id, body.model_dump())
    response.status_code = status
    return payload


@router.patch('/roles/{role_id}')
async def patch_role(role_id: int, body: UpdateRoleRequest, response: Response, auth: AuthContext = Depends(require_admin)):
    status, payload = await update_role(auth.company_id, role_id, body.model_dump(exclude_unset=True))
    response.status_code = status
    return payload


@router.delete('/roles/{role_id}')
async def remove_role(role_id: int, response: Response, auth: AuthContext = Depends(require_admin)):
    status, payload = await delete_role(auth.company_id, role_id)
    response.status_code = status
    return payload


@router.get('/members')
async def members(auth: AuthContext = Depends(require_admin)):
    return await list_members(auth.company_id)


@router.post('/members')
async def add_member(body: CreateMemberRequest, response: Response, auth: AuthContext = Depends(require_admin)):
    status, payload = await create_member(auth.company_id, body.model_dump())
    response.status_code = status
    return payload


@router.patch('/members/{member_id}')
async def patch_member(member_id: int, body: UpdateMemberRequest, response: Response, auth: AuthContext = Depends(require_admin)):
    if body.companyRoleId is None:
        response.status_code = 400
        return {'message': 'Provide at least one field to update'}
    status, payload = await update_member(auth.company_id, member_id, body.model_dump(exclude_unset=True))
    response.status_code = status
    return payload


@router.delete('/members/{member_id}')
async def remove_member(member_id: int, response: Response, auth: AuthContext = Depends(require_admin)):
    status, payload = await delete_member(auth.company_id, auth.user_id, member_id)
    response.status_code = status
    return payload
