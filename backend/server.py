from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ─── Models ────────────────────────────────────────
class UserProfile(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    personalization: Optional[dict] = None
    calendar_synced: bool = False

class PersonalizationData(BaseModel):
    name: str
    age: str
    gender: str
    profession: str
    role: str
    calendar_synced: bool = False

# ─── Auth Endpoints ────────────────────────────────
@api_router.post("/auth/session")
async def process_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    # Exchange session_id with Emergent Auth
    async with httpx.AsyncClient() as http_client:
        auth_resp = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        if auth_resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        auth_data = auth_resp.json()

    email = auth_data["email"]
    name = auth_data.get("name", "")
    picture = auth_data.get("picture", "")
    session_token = auth_data.get("session_token", f"st_{uuid.uuid4().hex}")

    # Upsert user
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if not existing:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "personalization": None,
            "calendar_synced": False,
            "created_at": datetime.now(timezone.utc),
        })
    else:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"email": email},
            {"$set": {"name": name, "picture": picture}}
        )

    # Store session
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.update_one(
        {"user_id": user_id},
        {"$set": {
            "session_token": session_token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc),
        }},
        upsert=True
    )

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 3600
    )

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user, "session_token": session_token}


# ─── Google Token Auth (for expo-auth-session) ─────
@api_router.post("/auth/google")
async def google_token_auth(request: Request, response: Response):
    body = await request.json()
    access_token = body.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="access_token required")

    # Verify token with Google userinfo API
    async with httpx.AsyncClient() as http_client:
        google_resp = await http_client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if google_resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Google token")
        google_data = google_resp.json()

    email = google_data.get("email", "")
    name = google_data.get("name", "")
    picture = google_data.get("picture", "")

    if not email:
        raise HTTPException(status_code=400, detail="No email from Google")

    # Upsert user
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if not existing:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "personalization": None,
            "calendar_synced": False,
            "google_access_token": access_token,
            "created_at": datetime.now(timezone.utc),
        })
    else:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"email": email},
            {"$set": {"name": name, "picture": picture, "google_access_token": access_token}}
        )

    # Create session
    session_token = f"st_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.update_one(
        {"user_id": user_id},
        {"$set": {
            "session_token": session_token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc),
        }},
        upsert=True
    )

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 3600
    )

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user, "session_token": session_token}



# ─── Mock Auth (for development) ───────────────────
@api_router.post("/auth/mock")
async def mock_auth(request: Request, response: Response):
    """MOCKED: Creates a demo user and session instantly."""
    mock_email = "atuljha2402@gmail.com"
    existing = await db.users.find_one({"email": mock_email}, {"_id": 0})
    if not existing:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": mock_email,
            "name": "Nuo User",
            "picture": "",
            "personalization": None,
            "calendar_synced": False,
            "created_at": datetime.now(timezone.utc),
        })
    else:
        user_id = existing["user_id"]

    session_token = f"st_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.update_one(
        {"user_id": user_id},
        {"$set": {"session_token": session_token, "expires_at": expires_at, "created_at": datetime.now(timezone.utc)}},
        upsert=True
    )

    response.set_cookie(key="session_token", value=session_token, httponly=True, secure=True, samesite="none", path="/", max_age=7*24*3600)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user, "session_token": session_token}



@api_router.get("/auth/me")
async def get_me(request: Request):
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Session not found")

    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out"}


# ─── Personalization ───────────────────────────────
@api_router.post("/user/personalization")
async def save_personalization(request: Request):
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    body = await request.json()
    await db.users.update_one(
        {"user_id": session["user_id"]},
        {"$set": {"personalization": body}}
    )
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    return user


# ─── Voice Upload ──────────────────────────────────
@api_router.post("/voice/upload")
async def upload_voice(request: Request):
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    body = await request.json()
    duration = body.get("duration", 0)
    # In production, process audio with AI. For now, acknowledge receipt.
    return {"status": "received", "duration": duration, "message": "Voice input processed"}


# ─── Google Calendar OAuth ─────────────────────────
GCAL_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
GCAL_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')
GCAL_SCOPES = 'https://www.googleapis.com/auth/calendar.readonly'

@api_router.get("/calendar/auth")
async def calendar_auth(request: Request):
    """Start Google Calendar OAuth - returns URL to redirect user to."""
    # Build redirect URI pointing to our backend callback
    base_url = str(request.base_url).rstrip('/')
    # Use the public URL from the request's host header
    host = request.headers.get('x-forwarded-host', request.headers.get('host', ''))
    scheme = request.headers.get('x-forwarded-proto', 'https')
    redirect_uri = f"{scheme}://{host}/api/calendar/callback"

    params = urlencode({
        'client_id': GCAL_CLIENT_ID,
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'scope': f'email profile {GCAL_SCOPES}',
        'access_type': 'offline',
        'prompt': 'consent',
        'state': 'calendar_sync',
    })
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{params}"
    return {"auth_url": auth_url, "redirect_uri": redirect_uri}


@api_router.get("/calendar/callback")
async def calendar_callback(code: str = '', state: str = '', request: Request = None):
    """Handle Google Calendar OAuth callback - exchange code for tokens."""
    if not code:
        return RedirectResponse("/debug?error=no_code")

    host = request.headers.get('x-forwarded-host', request.headers.get('host', ''))
    scheme = request.headers.get('x-forwarded-proto', 'https')
    redirect_uri = f"{scheme}://{host}/api/calendar/callback"

    # Exchange code for tokens
    async with httpx.AsyncClient() as http_client:
        token_resp = await http_client.post(
            'https://oauth2.googleapis.com/token',
            data={
                'code': code,
                'client_id': GCAL_CLIENT_ID,
                'client_secret': GCAL_CLIENT_SECRET,
                'redirect_uri': redirect_uri,
                'grant_type': 'authorization_code',
            }
        )
        token_data = token_resp.json()

    if 'access_token' not in token_data:
        error = token_data.get('error', 'unknown')
        return RedirectResponse(f"/debug?error={error}")

    # Get user email from token
    async with httpx.AsyncClient() as http_client:
        user_resp = await http_client.get(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            headers={'Authorization': f'Bearer {token_data["access_token"]}'}
        )
        user_data = user_resp.json()

    email = user_data.get('email', 'atuljha2402@gmail.com')

    # Store calendar tokens in user document
    await db.users.update_one(
        {"email": email},
        {"$set": {
            "google_calendar_tokens": {
                "access_token": token_data.get("access_token"),
                "refresh_token": token_data.get("refresh_token"),
                "expires_at": datetime.now(timezone.utc) + timedelta(seconds=token_data.get("expires_in", 3600)),
            },
            "calendar_synced": True,
        }},
        upsert=True
    )

    return RedirectResponse("/debug?calendar=connected")


@api_router.get("/calendar/events")
async def get_calendar_events(email: str = 'atuljha2402@gmail.com'):
    """Fetch calendar events using stored tokens."""
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not user.get("google_calendar_tokens"):
        raise HTTPException(status_code=400, detail="Calendar not connected. Please sync first.")

    tokens = user["google_calendar_tokens"]
    access_token = tokens["access_token"]

    # Check if token expired, refresh if needed
    expires_at = tokens.get("expires_at")
    if expires_at and isinstance(expires_at, datetime):
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc) and tokens.get("refresh_token"):
            # Refresh the token
            async with httpx.AsyncClient() as http_client:
                refresh_resp = await http_client.post(
                    'https://oauth2.googleapis.com/token',
                    data={
                        'client_id': GCAL_CLIENT_ID,
                        'client_secret': GCAL_CLIENT_SECRET,
                        'refresh_token': tokens["refresh_token"],
                        'grant_type': 'refresh_token',
                    }
                )
                refresh_data = refresh_resp.json()
                if 'access_token' in refresh_data:
                    access_token = refresh_data["access_token"]
                    await db.users.update_one(
                        {"email": email},
                        {"$set": {
                            "google_calendar_tokens.access_token": access_token,
                            "google_calendar_tokens.expires_at": datetime.now(timezone.utc) + timedelta(seconds=refresh_data.get("expires_in", 3600)),
                        }}
                    )

    # Fetch events from Google Calendar
    now = datetime.now(timezone.utc).isoformat()
    min_time = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    end_of_today = (datetime.now(timezone.utc).replace(hour=23, minute=59, second=59)).isoformat()

    async with httpx.AsyncClient() as http_client:
        events_resp = await http_client.get(
            'https://www.googleapis.com/calendar/v3/calendars/primary/events',
            headers={'Authorization': f'Bearer {access_token}'},
            params={
                'timeMin': min_time,
                'timeMax': end_of_today,
                'maxResults': 50,
                'singleEvents': 'true',
                'orderBy': 'startTime',
            }
        )
        if events_resp.status_code != 200:
            error_detail = events_resp.json().get('error', {}).get('message', 'Failed to fetch')
            raise HTTPException(status_code=events_resp.status_code, detail=error_detail)

        events_data = events_resp.json()

    # Return simplified events
    events = []
    for item in events_data.get('items', []):
        start = item.get('start', {})
        end = item.get('end', {})
        events.append({
            "id": item.get('id', ''),
            "summary": item.get('summary', '(No title)'),
            "start": start.get('dateTime', start.get('date', '')),
            "end": end.get('dateTime', end.get('date', '')),
            "status": item.get('status', ''),
            "location": item.get('location', ''),
        })

    return {"events": events, "count": len(events), "email": email}


# ─── Health check ──────────────────────────────────
@api_router.get("/")
async def root():
    return {"message": "Nuo API running"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
