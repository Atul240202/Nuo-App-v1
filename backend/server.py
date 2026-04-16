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
import tempfile
from urllib.parse import urlencode
from fastapi import UploadFile, File, Form

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


# ─── Voice Analysis ────────────────────────────────
from voice_analysis import (
    transcribe_audio, extract_acoustic_features, compute_emotion_scores,
    analyse_calendar, generate_insight, score_audio_tracks
)

@api_router.post("/voice/analyze")
async def analyze_voice(audio: UploadFile = File(...), user_id: str = Form("atuljha2402@gmail.com")):
    """Full Nuo voice analysis pipeline."""
    session_id = f"vs_{uuid.uuid4().hex[:12]}"

    # 1. Save audio to tempfile
    suffix = ".m4a" if audio.filename and audio.filename.endswith(".m4a") else ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await audio.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # 2. Transcribe with Whisper
        transcription = transcribe_audio(tmp_path)
        transcript = transcription["text"]

        # 3. Extract acoustic features
        acoustic = extract_acoustic_features(tmp_path)

        # 4. Compute emotion + stress scores
        scores = compute_emotion_scores(transcript, acoustic)

        # 5. Fetch calendar events
        cal_events = []
        try:
            user = await db.users.find_one({"email": user_id}, {"_id": 0})
            if user and user.get("google_calendar_tokens"):
                tokens = user["google_calendar_tokens"]
                access_token = tokens["access_token"]
                now_iso = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()
                end_iso = datetime.now(timezone.utc).replace(hour=23, minute=59, second=59).isoformat()
                async with httpx.AsyncClient() as http_client:
                    ev_resp = await http_client.get(
                        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
                        headers={'Authorization': f'Bearer {access_token}'},
                        params={'timeMin': now_iso, 'timeMax': end_iso, 'singleEvents': 'true', 'orderBy': 'startTime'}
                    )
                    if ev_resp.status_code == 200:
                        cal_events = ev_resp.json().get('items', [])
                        cal_events = [{"start": e.get("start",{}).get("dateTime",""), "end": e.get("end",{}).get("dateTime","")} for e in cal_events]
        except Exception as e:
            logger.error(f"Calendar fetch error: {e}")

        # 6. Analyse calendar
        cal_data = analyse_calendar(cal_events)

        # 7. Save voice session to MongoDB
        await db.voice_sessions.insert_one({
            "session_id": session_id,
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc),
            "emotion": scores["emotion"],
            "stress_score": scores["stress_score"],
            "recovery_score": scores["recovery_score"],
            "transcript": transcript,
        })

        # 8. Upsert calendar load
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        await db.calendar_loads.update_one(
            {"user_id": user_id, "date": today},
            {"$set": {**cal_data, "timestamp": datetime.now(timezone.utc)}},
            upsert=True
        )

        # 9. Generate LLM insight
        insight = await generate_insight(
            scores["emotion"], scores["stress_score"], scores["recovery_score"],
            transcript, cal_data
        )

        # 10. Score audio library
        audio_tracks_raw = await db.audio_library.find({}, {"_id": 0}).to_list(20)
        if not audio_tracks_raw:
            audio_tracks_raw = _get_seed_tracks()
        ranked_tracks = score_audio_tracks(scores["stress_score"], scores["emotion"], audio_tracks_raw)

        return {
            "session_id": session_id,
            "stress_score": scores["stress_score"],
            "recovery_score": scores["recovery_score"],
            "meeting_load_score": cal_data["meeting_load_score"],
            "capacity_left": cal_data["recovery_capacity_score"],
            "transcript": transcript,
            "emotion": scores["emotion"],
            "insight": insight,
            "audio_tracks": ranked_tracks,
            "calendar_data": cal_data,
        }
    except Exception as e:
        logger.error(f"Voice analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        import os as _os
        try: _os.unlink(tmp_path)
        except: pass


@api_router.post("/voice/upload")
async def upload_voice(request: Request):
    """Legacy endpoint - kept for compatibility."""
    body = await request.json()
    return {"status": "received", "duration": body.get("duration", 0)}


def _get_seed_tracks():
    """Default audio library if none seeded."""
    return [
        {"id": "t1", "title": "Deep Ocean Theta", "desc": "4.5Hz binaural + ocean waves", "duration": "10:00", "stress_tag": "high", "emotion_tag": ["stressed", "tense"], "file_url": ""},
        {"id": "t2", "title": "Forest Rain Reset", "desc": "6Hz theta + rain ambience", "duration": "10:00", "stress_tag": "medium", "emotion_tag": ["tense", "fatigued"], "file_url": ""},
        {"id": "t3", "title": "Silent Valley", "desc": "5Hz binaural + white noise", "duration": "10:00", "stress_tag": "medium", "emotion_tag": ["neutral", "fatigued"], "file_url": ""},
        {"id": "t4", "title": "Mountain Dawn", "desc": "7Hz alpha + birdsong", "duration": "10:00", "stress_tag": "low", "emotion_tag": ["positive", "neutral"], "file_url": ""},
        {"id": "t5", "title": "Midnight Drift", "desc": "3Hz delta + warm noise", "duration": "10:00", "stress_tag": "high", "emotion_tag": ["stressed", "fatigued"], "file_url": ""},
    ]


# ─── Google Calendar OAuth ─────────────────────────
GCAL_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
GCAL_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')
GCAL_SCOPES = 'https://www.googleapis.com/auth/calendar.readonly'

@api_router.get("/calendar/auth")
async def calendar_auth(request: Request, source: str = 'debug'):
    """Start Google Calendar OAuth - returns URL to redirect user to."""
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
        'state': source,
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
    real_name = user_data.get('name', '')
    picture = user_data.get('picture', '')

    # Store calendar tokens + update real name/picture
    await db.users.update_one(
        {"email": email},
        {"$set": {
            "google_calendar_tokens": {
                "access_token": token_data.get("access_token"),
                "refresh_token": token_data.get("refresh_token"),
                "expires_at": datetime.now(timezone.utc) + timedelta(seconds=token_data.get("expires_in", 3600)),
            },
            "calendar_synced": True,
            "name": real_name if real_name else "Nuo User",
            "picture": picture,
        }},
        upsert=True
    )

    # Redirect based on source
    if state == 'onboarding':
        return RedirectResponse("/transition")
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


# ─── Recovery Index ────────────────────────────────
@api_router.get("/recovery-index")
async def get_recovery_index(email: str = 'atuljha2402@gmail.com'):
    """
    1. Rolling avg of (recovery_score / recovery_capacity) over past 7 days
    2. Latest ratio minus rolling avg, expressed as percentage
    """
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    # Fetch voice sessions (recovery_score) from past 7 days
    sessions = await db.voice_sessions.find(
        {"user_id": email, "timestamp": {"$gte": seven_days_ago}},
        {"_id": 0, "recovery_score": 1, "timestamp": 1}
    ).sort("timestamp", -1).to_list(100)

    # Fetch calendar loads (recovery_capacity_score) from past 7 days
    loads = await db.calendar_loads.find(
        {"user_id": email, "timestamp": {"$gte": seven_days_ago}},
        {"_id": 0, "recovery_capacity_score": 1, "date": 1, "timestamp": 1}
    ).sort("timestamp", -1).to_list(100)

    # Build daily ratios: recovery_score / recovery_capacity (capped at 100)
    # Match sessions with calendar loads by date
    daily_ratios = []
    for s in sessions:
        ts = s["timestamp"]
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts)
        day = ts.strftime("%Y-%m-%d")
        rec_score = s.get("recovery_score", 50)

        # Find matching calendar load for that day
        cap = 100
        for l in loads:
            if l.get("date") == day:
                cap = max(1, l.get("recovery_capacity_score", 100))
                break

        ratio = min(100, round((rec_score / cap) * 100))
        daily_ratios.append({"date": day, "ratio": ratio, "recovery_score": rec_score, "capacity": cap})

    if not daily_ratios:
        return {
            "recovery_index": 50,
            "weekly_momentum": 0,
            "rolling_avg": 50,
            "latest_ratio": 50,
            "data_points": 0,
        }

    # Rolling average
    all_ratios = [d["ratio"] for d in daily_ratios]
    rolling_avg = round(sum(all_ratios) / len(all_ratios))

    # Latest ratio
    latest_ratio = daily_ratios[0]["ratio"]

    # Weekly momentum: (latest - rolling_avg) as percentage of rolling_avg
    if rolling_avg > 0:
        momentum = round(((latest_ratio - rolling_avg) / rolling_avg) * 100)
    else:
        momentum = 0

    return {
        "recovery_index": rolling_avg,
        "weekly_momentum": momentum,
        "rolling_avg": rolling_avg,
        "latest_ratio": latest_ratio,
        "data_points": len(daily_ratios),
    }


# ─── Sleep Debt ─────────────────────────────────────
@api_router.get("/sleep-debt")
async def get_sleep_debt(email: str = 'atuljha2402@gmail.com'):
    """Return past 3 days sleep debt data."""
    records = await db.sleep_debt.find(
        {"user_id": email}, {"_id": 0}
    ).sort("date", -1).to_list(3)
    records.reverse()
    avg_debt = round(sum(r.get("debt_hours", 0) for r in records) / max(len(records), 1), 1)
    latest_actual = records[-1].get("actual_sleep_hours", 0) if records else 0
    cumulative = records[-1].get("cumulative_debt_hours", 0) if records else 0
    return {
        "records": records,
        "avg_debt_3d": avg_debt,
        "latest_actual_sleep": latest_actual,
        "cumulative_debt": cumulative,
    }


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
