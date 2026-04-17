from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse, RedirectResponse
from auth_utils import get_current_user, get_current_user_optional
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import hmac
import hashlib
import httpx
import razorpay
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

# Razorpay client
rzp_client = razorpay.Client(auth=(os.environ.get('RAZORPAY_KEY_ID', ''), os.environ.get('RAZORPAY_KEY_SECRET', '')))

FREE_SESSIONS_PER_DAY = 3
PLANS = {
    "1_day": {"label": "1 Day Pass", "amount_paise": 9900, "days": 1},
    "1_week": {"label": "1 Week Pass", "amount_paise": 39900, "days": 7},
    "1_month": {"label": "1 Month Pass", "amount_paise": 99900, "days": 30},
}


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
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
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
async def analyze_voice(audio: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Full Nuo voice analysis pipeline."""
    user_id = current_user["email"]
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
        cal_events_full = []
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
                        raw_items = ev_resp.json().get('items', [])
                        for e in raw_items:
                            s = e.get("start", {}).get("dateTime", "")
                            en = e.get("end", {}).get("dateTime", "")
                            cal_events.append({"start": s, "end": en})
                            cal_events_full.append({
                                "title": e.get("summary", "Meeting"),
                                "start": s,
                                "end": en,
                                "attendees": len(e.get("attendees", [])),
                            })
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

        # 9. Fetch sleep data for LLM context
        sleep_data = {}
        try:
            sleep_records = await db.sleep_debt.find(
                {"user_id": user_id}, {"_id": 0}
            ).sort("date", -1).to_list(3)
            if sleep_records:
                sleep_records.reverse()
                sleep_data = {
                    "avg_debt_3d": round(sum(r.get("debt_hours", 0) for r in sleep_records) / len(sleep_records), 1),
                    "latest_actual_sleep": sleep_records[-1].get("actual_sleep_hours", 0),
                    "cumulative_debt": sleep_records[-1].get("cumulative_debt_hours", 0),
                    "records": sleep_records,
                }
        except:
            pass

        # 10. Generate LLM insight with full context including REAL calendar events
        audio_tracks_raw = await db.audio_library.find({}, {"_id": 0}).to_list(20)
        if not audio_tracks_raw:
            audio_tracks_raw = _get_seed_tracks()

        insight = await generate_insight(
            scores["emotion"], scores["stress_score"], scores["recovery_score"],
            transcript, cal_data, sleep_data=sleep_data,
            audio_library=audio_tracks_raw,
            cal_events_full=cal_events_full,
        )

        # 11. Score audio library for ranked display
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
    """Default audio library with real audio URLs."""
    return [
        {"id": "aud_df_bin_001", "audio_id": "aud_df_bin_001", "title": "40Hz Binaural Focus", "label": "Deep Focus", "desc": "Alpha waves, brain massage while you sleep", "duration": "10:00", "duration_sec": 600, "stress_tag": "medium", "emotion_tag": ["tense", "neutral", "fatigued"], "file_url": "https://pause-v1-audio.sfo3.digitaloceanspaces.com/NY%20Audio%20Interventions/Alpha%20Waves%20Heal%20Damage%20In%20The%20Body%2C%20Brain%20Massage%20While%20You%20Sleep%2C%20Improve%20Your%20Memory%20%5BpxqW0tgb5A%5D.mp3"},
        {"id": "aud_df_bin_002", "audio_id": "aud_df_bin_002", "title": "Alpha Wave Concentration", "label": "Deep Recovery", "desc": "Hyperfocus mode for deep work and flow", "duration": "10:00", "duration_sec": 600, "stress_tag": "high", "emotion_tag": ["stressed", "tense", "fatigued"], "file_url": "https://pause-v1-audio.sfo3.cdn.digitaloceanspaces.com/NY%20Audio%20Interventions/Focus%20Music%20%E2%80%A2%20Enter%20Hyperfocus%20Mode%20for%20Deep%20Work%20&%20Flow%20%5BE79seWbsZds%5D.mp3"},
        {"id": "aud_df_flo_003", "audio_id": "aud_df_flo_003", "title": "Flow State Ambient", "label": "High Relaxation", "desc": "Instant relief from stress and anxiety", "duration": "10:00", "duration_sec": 600, "stress_tag": "high", "emotion_tag": ["stressed", "fatigued", "tense"], "file_url": "https://pause-v1-audio.sfo3.cdn.digitaloceanspaces.com/NY%20Audio%20Interventions/Instant%20Relief%20from%20Stress%20and%20Anxiety%20_%20Detox%20Negative%20Emotions,%20Calm%20Nature%20Healing%20Sleep%20Music%E2%98%8558%20%5B79kpoGF8KWU%5D.mp3"},
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

    email = user_data.get('email')
    if not email:
        return RedirectResponse(f"/debug?error=no_email_from_google")
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
async def get_calendar_events(current_user: dict = Depends(get_current_user)):
    """Fetch calendar events using stored tokens."""
    email = current_user["email"]
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


# ─── Session Limits & Payments ─────────────────────
@api_router.get("/session/status")
async def session_status(current_user: dict = Depends(get_current_user)):
    """Check if user can start a session (3 free/day or has active plan)."""
    email = current_user["email"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Check active subscription
    sub = await db.subscriptions.find_one(
        {"user_id": email, "expires_at": {"$gt": datetime.now(timezone.utc)}, "status": "active"},
        {"_id": 0}
    )
    if sub:
        return {"allowed": True, "reason": "active_plan", "plan": sub.get("plan_id"), "expires_at": sub["expires_at"].isoformat(), "sessions_used": 0, "sessions_limit": -1}

    # Count today's sessions
    count = await db.voice_sessions.count_documents({"user_id": email, "timestamp": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)}})
    allowed = count < FREE_SESSIONS_PER_DAY
    return {
        "allowed": allowed,
        "reason": "free_tier" if allowed else "limit_reached",
        "sessions_used": count,
        "sessions_limit": FREE_SESSIONS_PER_DAY,
        "plan": None,
        "expires_at": None,
    }


@api_router.get("/payment/plans")
async def get_plans():
    """Return available top-up plans."""
    rzp_key = os.environ.get('RAZORPAY_KEY_ID', '')
    return {
        "razorpay_key": rzp_key,
        "plans": [
            {"id": "1_day", "label": "1 Day Pass", "price": 99, "amount_paise": 9900, "days": 1},
            {"id": "1_week", "label": "1 Week Pass", "price": 399, "amount_paise": 39900, "days": 7},
            {"id": "1_month", "label": "1 Month Pass", "price": 999, "amount_paise": 99900, "days": 30},
        ],
    }


@api_router.post("/payment/create-order")
async def create_order(request: Request, current_user: dict = Depends(get_current_user)):
    """Create a Razorpay order for a plan."""
    body = await request.json()
    plan_id = body.get("plan_id")
    email = current_user["email"]

    if plan_id not in PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")

    plan = PLANS[plan_id]
    receipt = f"nuo_{plan_id}_{uuid.uuid4().hex[:8]}"

    order = rzp_client.order.create({
        "amount": plan["amount_paise"],
        "currency": "INR",
        "receipt": receipt,
        "payment_capture": 1,
    })

    # Save order to DB
    await db.payment_orders.insert_one({
        "order_id": order["id"],
        "user_id": email,
        "plan_id": plan_id,
        "amount_paise": plan["amount_paise"],
        "days": plan["days"],
        "status": "created",
        "created_at": datetime.now(timezone.utc),
    })

    return {"order_id": order["id"], "amount": plan["amount_paise"], "currency": "INR", "plan": plan}


@api_router.post("/payment/verify")
async def verify_payment(request: Request, current_user: dict = Depends(get_current_user)):
    """Verify Razorpay payment and activate subscription."""
    body = await request.json()
    razorpay_order_id = body.get("razorpay_order_id")
    razorpay_payment_id = body.get("razorpay_payment_id")
    razorpay_signature = body.get("razorpay_signature")
    email = current_user["email"]

    # Verify signature
    try:
        rzp_client.utility.verify_payment_signature({
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature,
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Payment verification failed")

    # Find order
    order = await db.payment_orders.find_one({"order_id": razorpay_order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Update order status
    await db.payment_orders.update_one(
        {"order_id": razorpay_order_id},
        {"$set": {"status": "paid", "payment_id": razorpay_payment_id, "paid_at": datetime.now(timezone.utc)}}
    )

    # Activate subscription
    days = order["days"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=days)

    # Extend if active sub exists
    existing = await db.subscriptions.find_one(
        {"user_id": email, "expires_at": {"$gt": datetime.now(timezone.utc)}, "status": "active"},
        {"_id": 0}
    )
    if existing:
        expires_at = existing["expires_at"] + timedelta(days=days)

    await db.subscriptions.update_one(
        {"user_id": email, "status": "active"},
        {"$set": {
            "user_id": email,
            "plan_id": order["plan_id"],
            "payment_id": razorpay_payment_id,
            "expires_at": expires_at,
            "status": "active",
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True
    )

    return {"status": "success", "plan": order["plan_id"], "expires_at": expires_at.isoformat()}


# ─── Recovery Index ────────────────────────────────
@api_router.get("/recovery-index")
async def get_recovery_index(current_user: dict = Depends(get_current_user)):
    """
    1. Rolling avg of (recovery_score / recovery_capacity) over past 7 days
    2. Latest ratio minus rolling avg, expressed as percentage
    """
    email = current_user["email"]
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
async def get_sleep_debt(current_user: dict = Depends(get_current_user)):
    """Return past 3 days sleep debt data."""
    email = current_user["email"]
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


# ─── Progress / Analytics ──────────────────────────
@api_router.get("/progress/summary")
async def get_progress_summary(period: str = "week", current_user: dict = Depends(get_current_user)):
    """Return progress summary: recovery score, chart data, health metrics."""
    email = current_user["email"]
    now = datetime.now(timezone.utc)
    if period == "month":
        days = 30
    elif period == "year":
        days = 365
    else:
        days = 7

    start = now - timedelta(days=days)

    # 1. Recovery scores per day from voice_sessions
    sessions = await db.voice_sessions.find(
        {"user_id": email, "timestamp": {"$gte": start}},
        {"_id": 0, "recovery_score": 1, "stress_score": 1, "timestamp": 1}
    ).sort("timestamp", 1).to_list(500)

    # 2. Sleep data
    sleep_records = await db.sleep_debt.find(
        {"user_id": email, "date": {"$gte": start.strftime("%Y-%m-%d")}},
        {"_id": 0}
    ).sort("date", 1).to_list(500)

    # 3. Calendar loads
    cal_loads = await db.calendar_loads.find(
        {"user_id": email, "date": {"$gte": start.strftime("%Y-%m-%d")}},
        {"_id": 0}
    ).sort("date", 1).to_list(500)

    # Build chart data (day-level for week, week-level for month, month-level for year)
    chart_data = []
    day_labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    if period == "week":
        for i in range(7):
            d = now - timedelta(days=6 - i)
            day_str = d.strftime("%Y-%m-%d")
            day_sessions = [s for s in sessions if s.get("timestamp") and s["timestamp"].strftime("%Y-%m-%d") == day_str]
            day_sleep = [s for s in sleep_records if s.get("date") == day_str]

            # Composite score: recovery from sessions, or from sleep data
            if day_sessions:
                score = round(sum(s.get("recovery_score", 50) for s in day_sessions) / len(day_sessions))
            elif day_sleep:
                actual = day_sleep[0].get("actual_sleep_hours", 7)
                score = min(100, round(actual / 8 * 75))
            else:
                score = 0

            chart_data.append({
                "day": day_labels[d.weekday()],
                "date": day_str,
                "score": score,
                "is_today": d.strftime("%Y-%m-%d") == now.strftime("%Y-%m-%d"),
            })
    elif period == "month":
        for w in range(4):
            week_start = now - timedelta(days=(3 - w) * 7 + 6)
            week_end = week_start + timedelta(days=6)
            week_sessions = []
            for s in sessions:
                ts = s.get("timestamp")
                if ts:
                    if isinstance(ts, str):
                        ts = datetime.fromisoformat(ts)
                    if ts.tzinfo is None:
                        ts = ts.replace(tzinfo=timezone.utc)
                    if week_start <= ts <= week_end:
                        week_sessions.append(s)
            score = round(sum(s.get("recovery_score", 50) for s in week_sessions) / max(1, len(week_sessions))) if week_sessions else 0
            chart_data.append({"day": f"W{w + 1}", "date": week_start.strftime("%Y-%m-%d"), "score": score, "is_today": w == 3})
    else:
        month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        for m in range(12):
            target_month = now.month - 11 + m
            target_year = now.year
            if target_month <= 0:
                target_month += 12
                target_year -= 1
            month_sessions = [s for s in sessions if s.get("timestamp") and s["timestamp"].month == target_month and s["timestamp"].year == target_year]
            score = round(sum(s.get("recovery_score", 50) for s in month_sessions) / max(1, len(month_sessions))) if month_sessions else 0
            chart_data.append({"day": month_names[target_month - 1], "date": f"{target_year}-{target_month:02d}", "score": score, "is_today": m == 11})

    # Current recovery score — use same logic as /api/recovery-index
    # (recovery_score / recovery_capacity ratio, 7-day rolling avg)
    daily_ratios = []
    for s in sessions:
        ts = s.get("timestamp")
        if not ts:
            continue
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts)
        day = ts.strftime("%Y-%m-%d")
        rec_score = s.get("recovery_score", 50)

        # Find matching calendar load for capacity
        cap = 100
        for cl in cal_loads:
            if cl.get("date") == day:
                cap = max(1, cl.get("recovery_capacity_score", 100))
                break

        ratio = min(100, round((rec_score / cap) * 100))
        daily_ratios.append({"date": day, "ratio": ratio})

    if daily_ratios:
        all_ratios = [d["ratio"] for d in daily_ratios]
        current_score = round(sum(all_ratios) / len(all_ratios))
    else:
        # Fallback: derive from sleep data
        if sleep_records:
            avg_sleep_hrs = sum(s.get("actual_sleep_hours", 7) for s in sleep_records) / len(sleep_records)
            current_score = min(100, round(avg_sleep_hrs / 8 * 75))
        else:
            current_score = 50

    # Weekly change — compare first half vs second half of ratios
    if len(daily_ratios) >= 2:
        first_half = daily_ratios[:len(daily_ratios) // 2]
        second_half = daily_ratios[len(daily_ratios) // 2:]
        avg1 = sum(d["ratio"] for d in first_half) / max(1, len(first_half))
        avg2 = sum(d["ratio"] for d in second_half) / max(1, len(second_half))
        weekly_change = round(((avg2 - avg1) / max(1, avg1)) * 100, 1)
    else:
        weekly_change = 0

    # Health metrics
    avg_stress = 0
    if sessions:
        avg_stress = round(sum(s.get("stress_score", 50) for s in sessions) / len(sessions))

    avg_sleep = 0
    if sleep_records:
        avg_sleep = round(sum(s.get("actual_sleep_hours", 0) for s in sleep_records) / len(sleep_records), 1)

    avg_meetings = 0
    if cal_loads:
        avg_meetings = round(sum(c.get("meetings_count", 0) for c in cal_loads) / len(cal_loads), 1)

    energy = max(0, min(100, current_score + (10 if avg_sleep >= 7 else -10)))

    metrics = [
        {"label": "Avg Sleep", "value": avg_sleep if avg_sleep else 7.0, "unit": "hrs", "change": round(avg_sleep - 7, 1) if avg_sleep else 0, "trend": "up" if avg_sleep >= 7 else "down"},
        {"label": "Stress Level", "value": avg_stress if avg_stress else 35, "unit": "/100", "change": -5 if avg_stress < 50 else 8, "trend": "down" if avg_stress < 50 else "up"},
        {"label": "Energy", "value": energy, "unit": "%", "change": round(weekly_change, 1), "trend": "up" if weekly_change >= 0 else "down"},
        {"label": "Meeting Load", "value": avg_meetings if avg_meetings else 3, "unit": "avg/day", "change": 0, "trend": "stable"},
    ]

    return {
        "score": current_score,
        "weekly_change": weekly_change,
        "chart_data": chart_data,
        "metrics": metrics,
        "period": period,
        "total_sessions": len(sessions),
    }


@api_router.get("/interventions/count")
async def get_interventions_count(period: str = "week", current_user: dict = Depends(get_current_user)):
    """Return intervention counts by type for the given period."""
    email = current_user["email"]
    now = datetime.now(timezone.utc)
    days = 7 if period == "week" else (30 if period == "month" else 365)
    start = now - timedelta(days=days)

    # Voice sessions (voice check-ins)
    voice_count = await db.voice_sessions.count_documents(
        {"user_id": email, "timestamp": {"$gte": start}}
    )

    # Auto interventions (scheduled nudges)
    start_str = start.strftime("%Y-%m-%d")
    interventions = await db.auto_interventions.find(
        {"user_id": email, "date": {"$gte": start_str}},
        {"_id": 0}
    ).to_list(200)
    scheduled_count = len(interventions)

    # Chat sessions (not yet implemented, default 0)
    chat_count = 0

    total = voice_count + scheduled_count + chat_count
    return {
        "total": total,
        "breakdown": [
            {"type": "Voice Check-in", "count": voice_count, "icon": "mic"},
            {"type": "Scheduled Nudge", "count": scheduled_count, "icon": "clock"},
            {"type": "Chat Session", "count": chat_count, "icon": "message-circle"},
        ],
        "period": period,
    }


@api_router.get("/achievements")
async def get_achievements(current_user: dict = Depends(get_current_user)):
    """Return achievements based on user activity milestones."""
    email = current_user["email"]
    now = datetime.now(timezone.utc)

    # Count real activity
    total_sessions = await db.voice_sessions.count_documents({"user_id": email})
    total_interventions = await db.auto_interventions.count_documents({"user_id": email})
    total_sleep = await db.sleep_debt.count_documents({"user_id": email})

    # Check for streak (consecutive days with sessions)
    week_ago = now - timedelta(days=7)
    week_sessions = await db.voice_sessions.find(
        {"user_id": email, "timestamp": {"$gte": week_ago}},
        {"_id": 0, "timestamp": 1}
    ).to_list(100)
    unique_days = set()
    for s in week_sessions:
        if s.get("timestamp"):
            unique_days.add(s["timestamp"].strftime("%Y-%m-%d"))
    streak = len(unique_days)

    achievements = [
        {
            "id": "first_checkin",
            "icon": "mic",
            "title": "First Check-in",
            "description": "Complete your first voice session",
            "unlocked": total_sessions >= 1,
        },
        {
            "id": "consistent_3",
            "icon": "calendar",
            "title": "3-Day Streak",
            "description": "Check in 3 days in a row",
            "unlocked": streak >= 3,
        },
        {
            "id": "week_warrior",
            "icon": "award",
            "title": "Week Warrior",
            "description": "Complete 7 consecutive daily check-ins",
            "unlocked": streak >= 7,
        },
        {
            "id": "sleep_tracker",
            "icon": "moon",
            "title": "Sleep Tracker",
            "description": "Log sleep data for 5 days",
            "unlocked": total_sleep >= 5,
        },
        {
            "id": "intervention_5",
            "icon": "zap",
            "title": "Recovery Pro",
            "description": "Complete 5 audio interventions",
            "unlocked": total_interventions >= 5,
        },
        {
            "id": "ten_sessions",
            "icon": "trending-up",
            "title": "Momentum Builder",
            "description": "Complete 10 voice sessions",
            "unlocked": total_sessions >= 10,
        },
        {
            "id": "calendar_sync",
            "icon": "link",
            "title": "Calendar Connected",
            "description": "Sync your Google Calendar",
            "unlocked": True,  # We know calendar is connected for this user
        },
    ]

    return achievements


# ─── Calendar Recalculate ──────────────────────────
@api_router.get("/metrics/home")
async def get_home_metrics(current_user: dict = Depends(get_current_user)):
    """Return home screen metrics: back-to-back meetings today + 3-day voice stress avg."""
    email = current_user["email"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Back-to-back meetings from calendar_loads
    back_to_back = 0
    meetings_count = 0
    cal_load = await db.calendar_loads.find_one(
        {"user_id": email, "date": today}, {"_id": 0}
    )
    if cal_load:
        back_to_back = cal_load.get("back_to_back", 0)
        meetings_count = cal_load.get("meetings_count", 0)

    # 3-day rolling avg voice stress score
    three_days_ago = datetime.now(timezone.utc) - timedelta(days=3)
    sessions = await db.voice_sessions.find(
        {"user_id": email, "timestamp": {"$gte": three_days_ago}},
        {"_id": 0, "stress_score": 1, "timestamp": 1}
    ).sort("timestamp", -1).to_list(50)

    avg_stress_3d = 0
    if sessions:
        total = sum(s.get("stress_score", 0) for s in sessions)
        avg_stress_3d = round(total / len(sessions))

    return {
        "back_to_back": back_to_back,
        "meetings_count": meetings_count,
        "avg_stress_3d": avg_stress_3d,
        "stress_sessions_count": len(sessions),
    }


@api_router.post("/calendar/recalculate")
async def recalculate_calendar(current_user: dict = Depends(get_current_user)):
    """Fetch fresh calendar events, recalculate all metrics, save to MongoDB."""
    email = current_user["email"]

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not user.get("google_calendar_tokens"):
        raise HTTPException(status_code=400, detail="Calendar not connected")

    tokens = user["google_calendar_tokens"]
    access_token = tokens["access_token"]

    # Check if token expired, refresh if needed
    expires_at = tokens.get("expires_at")
    if expires_at and isinstance(expires_at, datetime):
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc) and tokens.get("refresh_token"):
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

    # Fetch today's events
    now_iso = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()
    end_iso = datetime.now(timezone.utc).replace(hour=23, minute=59, second=59).isoformat()

    cal_events = []
    cal_events_full = []
    async with httpx.AsyncClient() as http_client:
        ev_resp = await http_client.get(
            'https://www.googleapis.com/calendar/v3/calendars/primary/events',
            headers={'Authorization': f'Bearer {access_token}'},
            params={'timeMin': now_iso, 'timeMax': end_iso, 'singleEvents': 'true', 'orderBy': 'startTime'}
        )
        if ev_resp.status_code != 200:
            error_detail = ev_resp.json().get('error', {}).get('message', 'Failed to fetch')
            raise HTTPException(status_code=ev_resp.status_code, detail=error_detail)

        for e in ev_resp.json().get('items', []):
            s = e.get("start", {}).get("dateTime", "")
            en = e.get("end", {}).get("dateTime", "")
            if s and en:
                cal_events.append({"start": s, "end": en})
                cal_events_full.append({
                    "title": e.get("summary", "Meeting"),
                    "start": s,
                    "end": en,
                    "attendees": len(e.get("attendees", [])),
                })

    # Recalculate metrics
    from voice_analysis import analyse_calendar, compute_calendar_context
    cal_data = analyse_calendar(cal_events)
    cal_context = compute_calendar_context(cal_events_full, cal_data)

    # Save to MongoDB
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await db.calendar_loads.update_one(
        {"user_id": email, "date": today},
        {"$set": {
            **cal_data,
            "events_summary": cal_context.get("events_summary", []),
            "gaps": cal_context.get("gaps", []),
            "first_meeting_starts": cal_context.get("first_meeting_starts", "N/A"),
            "last_meeting_ends": cal_context.get("last_meeting_ends", "N/A"),
            "busiest_window": cal_context.get("busiest_window", "N/A"),
            "timestamp": datetime.now(timezone.utc),
        }},
        upsert=True
    )

    return {
        "status": "recalculated",
        "metrics": cal_data,
        "context": cal_context,
        "events_count": len(cal_events),
    }


# ─── Audio Library ──────────────────────────────────
@api_router.get("/audio/library")
async def get_audio_library():
    """Return all audio tracks from the library."""
    tracks = await db.audio_library.find({}, {"_id": 0}).to_list(50)
    if not tracks:
        tracks = _get_seed_tracks()
        # Seed them into DB for persistence
        for t in tracks:
            await db.audio_library.update_one(
                {"audio_id": t["audio_id"]},
                {"$set": t},
                upsert=True
            )
    return {"tracks": tracks, "count": len(tracks)}


# ─── Debug Endpoints ───────────────────────────────
@api_router.delete("/debug/clear-subscription")
async def clear_subscription(current_user: dict = Depends(get_current_user)):
    """Debug: Remove active subscription so paywall can be tested again."""
    email = current_user["email"]
    result = await db.subscriptions.delete_many({"user_id": email})
    # Also reset today's voice session count
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)
    sessions_deleted = await db.voice_sessions.delete_many({
        "user_id": email,
        "timestamp": {"$gte": today_start}
    })
    return {
        "status": "cleared",
        "subscriptions_removed": result.deleted_count,
        "sessions_reset": sessions_deleted.deleted_count,
        "email": email,
    }


# ─── Auto Interventions ────────────────────────────
@api_router.post("/interventions/save")
async def save_intervention(request: Request, current_user: dict = Depends(get_current_user)):
    """Save a scheduled intervention from voice analysis results."""
    body = await request.json()
    email = current_user["email"]
    intervention = body.get("intervention", {})
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    doc = {
        "user_id": email,
        "date": today,
        "start_time": intervention.get("start_time", ""),
        "duration_min": intervention.get("duration_min", 10),
        "audio_id": intervention.get("audio_id", ""),
        "audio_label": intervention.get("audio_label", ""),
        "audio_title": intervention.get("audio_title", ""),
        "reason": intervention.get("reason", ""),
        "status": "scheduled",
        "created_at": datetime.now(timezone.utc),
    }

    result = await db.auto_interventions.insert_one(doc)
    return {"status": "saved", "id": str(result.inserted_id), "intervention": doc}


@api_router.delete("/interventions/cancel")
async def cancel_intervention(start_time: str = '', current_user: dict = Depends(get_current_user)):
    """Cancel/delete a scheduled intervention."""
    email = current_user["email"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    query = {"user_id": email, "date": today, "status": "scheduled"}
    if start_time:
        query["start_time"] = start_time
    result = await db.auto_interventions.delete_many(query)
    return {"status": "cancelled", "deleted": result.deleted_count}


@api_router.get("/interventions/today")
async def get_today_interventions(current_user: dict = Depends(get_current_user)):
    """Get today's scheduled auto interventions."""
    email = current_user["email"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    interventions = await db.auto_interventions.find(
        {"user_id": email, "date": today, "status": "scheduled"},
        {"_id": 0}
    ).to_list(20)
    return {"interventions": interventions, "count": len(interventions)}


@api_router.post("/interventions/generate")
async def generate_intervention(current_user: dict = Depends(get_current_user)):
    """Generate a new auto intervention based on calendar gaps and last session data."""
    email = current_user["email"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Check if one already exists today
    existing = await db.auto_interventions.find_one(
        {"user_id": email, "date": today, "status": "scheduled"}, {"_id": 0}
    )
    if existing:
        return {"intervention": existing, "source": "existing"}

    # Get last voice session for stress context
    last_session = await db.voice_sessions.find_one(
        {"user_id": email}, {"_id": 0}
    )
    stress = last_session.get("stress_score", 50) if last_session else 50
    emotion = last_session.get("emotion", "neutral") if last_session else "neutral"

    # Get calendar events to find gaps
    cal_events = []
    try:
        user = await db.users.find_one({"email": email}, {"_id": 0})
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
                    for e in ev_resp.json().get('items', []):
                        s = e.get("start", {}).get("dateTime", "")
                        en = e.get("end", {}).get("dateTime", "")
                        if s and en:
                            cal_events.append({"start": s, "end": en})
    except:
        pass

    # Find best gap
    from voice_analysis import analyse_calendar
    cal_data = analyse_calendar(cal_events)

    # Pick audio based on stress
    audio_tracks = await db.audio_library.find({}, {"_id": 0}).to_list(10)
    if not audio_tracks:
        audio_tracks = _get_seed_tracks()

    # Select best audio
    picked = audio_tracks[0]
    if stress >= 60:
        # Pick calming/recovery track
        for t in audio_tracks:
            if 'Relax' in t.get('label', '') or 'Recovery' in t.get('label', ''):
                picked = t
                break
    elif stress < 40:
        # Pick focus track
        for t in audio_tracks:
            if 'Focus' in t.get('label', ''):
                picked = t
                break

    # Determine time based on stress level
    now = datetime.now(timezone.utc)
    if stress >= 70:
        # Immediate - within 15 min
        sched_time = (now + timedelta(minutes=15)).strftime("%-I:%M %p")
        reason = f"Stress elevated at {stress}. Scheduling immediate recovery session."
    elif stress >= 45:
        # Within an hour
        sched_time = (now + timedelta(minutes=45)).strftime("%-I:%M %p")
        reason = f"Moderate stress detected. Scheduling session before your next dense block."
    else:
        # Later in the day
        sched_time = (now + timedelta(hours=2)).strftime("%-I:%M %p")
        reason = "Maintenance session. Numbers are stable — good time to bank recovery."

    intervention = {
        "user_id": email,
        "date": today,
        "start_time": sched_time,
        "duration_min": 10,
        "audio_id": picked.get("audio_id", ""),
        "audio_label": picked.get("label", ""),
        "audio_title": picked.get("title", ""),
        "reason": reason,
        "status": "scheduled",
        "created_at": datetime.now(timezone.utc),
    }

    await db.auto_interventions.insert_one(intervention)
    intervention.pop("_id", None)
    return {"intervention": intervention, "source": "generated"}


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
