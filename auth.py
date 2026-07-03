"""
SokoPrice Auth Utilities
JWT token creation/validation and password hashing.
"""

import hashlib
import hmac
import json
import base64
import time
from fastapi import HTTPException, Header
from typing import Optional

SECRET = "sokoprice-secret-2026-alu"


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed


def create_token(user_id: int, email: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": int(time.time()) + 86400 * 7  # 7 days
    }
    data = base64.b64encode(json.dumps(payload).encode()).decode()
    sig  = hmac.new(SECRET.encode(), data.encode(), hashlib.sha256).hexdigest()
    return f"{data}.{sig}"


def decode_token(token: str) -> dict:
    try:
        data, sig = token.rsplit(".", 1)
        expected = hmac.new(SECRET.encode(), data.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            raise ValueError("bad signature")
        payload = json.loads(base64.b64decode(data).decode())
        if payload["exp"] < int(time.time()):
            raise ValueError("expired")
        return payload
    except Exception:
        raise HTTPException(401, "Invalid or expired token")


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    return decode_token(authorization.split(" ", 1)[1])


def require_admin(authorization: Optional[str] = Header(None)) -> dict:
    user = get_current_user(authorization)
    if user["role"] != "admin":
        raise HTTPException(403, "Admin access required")
    return user


def require_seller(authorization: Optional[str] = Header(None)) -> dict:
    user = get_current_user(authorization)
    if user["role"] not in ("seller", "admin"):
        raise HTTPException(403, "Seller access required")
    return user
