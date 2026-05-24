from __future__ import annotations

import hashlib
from enum import Enum


class ReturnDocument(Enum):
    BEFORE = 0
    AFTER = 1


class DuplicateKeyError(Exception):
    pass


class CryptContext:
    def __init__(self, schemes=None, deprecated: str | None = None):
        self.schemes = schemes or ['sha256']
        self.deprecated = deprecated

    def hash(self, value: str) -> str:
        return hashlib.sha256(value.encode('utf-8')).hexdigest()

    def verify(self, plain: str, hashed: str) -> bool:
        return self.hash(plain) == hashed


# Prefer real libs when installed; fallback keeps editor/runtime usable in restricted envs.
try:
    from pymongo import ReturnDocument as _RD  # type: ignore
    ReturnDocument = _RD  # type: ignore[assignment]
except Exception:
    pass

try:
    from pymongo.errors import DuplicateKeyError as _DKE  # type: ignore
    DuplicateKeyError = _DKE  # type: ignore[assignment]
except Exception:
    pass

try:
    from passlib.context import CryptContext as _CC  # type: ignore
    CryptContext = _CC  # type: ignore[assignment]
except Exception:
    pass
