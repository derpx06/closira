import inspect
import functools
from datetime import datetime
from bson import ObjectId
from fastapi.routing import APIRoute
from typing import Callable, Any


def jsonable_mongo(value):
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value
    if isinstance(value, list):
        return [jsonable_mongo(v) for v in value]
    if isinstance(value, dict):
        return {k: jsonable_mongo(v) for k, v in value.items()}
    return value


class MongoFriendlyRoute(APIRoute):
    def __init__(self, path: str, endpoint: Callable[..., Any], **kwargs: Any) -> None:
        if inspect.iscoroutinefunction(endpoint):
            @functools.wraps(endpoint)
            async def wrapped_endpoint(*args: Any, **wrapped_kwargs: Any) -> Any:
                res = await endpoint(*args, **wrapped_kwargs)
                return jsonable_mongo(res)
            super().__init__(path, wrapped_endpoint, **kwargs)
        else:
            @functools.wraps(endpoint)
            def wrapped_endpoint(*args: Any, **wrapped_kwargs: Any) -> Any:
                res = endpoint(*args, **wrapped_kwargs)
                return jsonable_mongo(res)
            super().__init__(path, wrapped_endpoint, **kwargs)
