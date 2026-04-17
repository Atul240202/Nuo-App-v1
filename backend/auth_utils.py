"""Authentication helpers: extract user from cookie or Bearer header."""
from fastapi import Request, HTTPException
from datetime import datetime, timezone


async def get_current_user(request: Request):
    """
    FastAPI dependency. Returns the full user dict for the active session.
    Token is read from:
      1. httpOnly cookie `session_token`
      2. `Authorization: Bearer <token>` header
    Raises 401 if missing, invalid, or expired.
    """
    # lazy import to avoid circular
    from server import db

    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def get_current_user_optional(request: Request):
    """Same as above but returns None instead of raising."""
    try:
        return await get_current_user(request)
    except HTTPException:
        return None
