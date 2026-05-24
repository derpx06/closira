from fastapi import HTTPException


def unauthorized(message: str = 'Authentication required.') -> HTTPException:
    return HTTPException(status_code=401, detail=message)


def forbidden(message: str = 'Admin access required.') -> HTTPException:
    return HTTPException(status_code=403, detail=message)
