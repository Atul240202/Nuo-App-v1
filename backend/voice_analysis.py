"""
Nuo Voice Analysis Pipeline
- Whisper transcription
- Acoustic feature extraction (librosa)
- Emotion/stress scoring
- Calendar load analysis
- LLM insight generation (GPT-4o via Emergent)
"""
import os
import uuid
import tempfile
import json
import logging
from datetime import datetime, timezone, timedelta

import whisper
import librosa
import numpy as np
from textblob import TextBlob

from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

# Load Whisper model (tiny for speed)
_whisper_model = None

def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        logger.info("Loading Whisper tiny model...")
        _whisper_model = whisper.load_model("tiny")
        logger.info("Whisper model loaded.")
    return _whisper_model


def transcribe_audio(audio_path: str) -> dict:
    """Transcribe audio with Whisper and return text + language."""
    model = get_whisper_model()
    result = model.transcribe(audio_path, fp16=False)
    return {
        "text": result.get("text", "").strip(),
        "language": result.get("language", "en"),
    }


def extract_acoustic_features(audio_path: str) -> dict:
    """Extract voice features using librosa for emotion/stress estimation."""
    try:
        y, sr = librosa.load(audio_path, sr=22050, duration=60)
        if len(y) == 0:
            return _default_acoustic()

        # Pitch (fundamental frequency)
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
        pitch_vals = pitches[magnitudes > np.median(magnitudes)]
        pitch_vals = pitch_vals[pitch_vals > 0]
        pitch_mean = float(np.mean(pitch_vals)) if len(pitch_vals) > 0 else 150.0
        pitch_std = float(np.std(pitch_vals)) if len(pitch_vals) > 0 else 30.0

        # Energy / RMS
        rms = librosa.feature.rms(y=y)[0]
        energy_mean = float(np.mean(rms))
        energy_std = float(np.std(rms))

        # Speech rate (zero crossing rate as proxy)
        zcr = librosa.feature.zero_crossing_rate(y)[0]
        speech_rate = float(np.mean(zcr))

        # Spectral centroid (brightness - higher = more tense)
        centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        centroid_mean = float(np.mean(centroid))

        return {
            "pitch_mean": round(pitch_mean, 1),
            "pitch_std": round(pitch_std, 1),
            "energy_mean": round(energy_mean, 4),
            "energy_std": round(energy_std, 4),
            "speech_rate": round(speech_rate, 4),
            "spectral_centroid": round(centroid_mean, 1),
        }
    except Exception as e:
        logger.error(f"Acoustic extraction error: {e}")
        return _default_acoustic()


def _default_acoustic():
    return {
        "pitch_mean": 150.0, "pitch_std": 30.0,
        "energy_mean": 0.05, "energy_std": 0.02,
        "speech_rate": 0.08, "spectral_centroid": 2000.0,
    }


def compute_emotion_scores(transcript: str, acoustic: dict) -> dict:
    """Combine text sentiment + acoustic features → stress/recovery scores."""
    # Text sentiment
    blob = TextBlob(transcript) if transcript else TextBlob("")
    polarity = blob.sentiment.polarity      # -1 (negative) to 1 (positive)
    subjectivity = blob.sentiment.subjectivity  # 0 (objective) to 1 (subjective)

    # Acoustic stress indicators
    # High pitch variability → stress
    pitch_stress = min(100, max(0, (acoustic["pitch_std"] - 20) * 2))
    # High energy variability → agitation
    energy_stress = min(100, max(0, acoustic["energy_std"] * 2000))
    # High speech rate → anxiety
    rate_stress = min(100, max(0, (acoustic["speech_rate"] - 0.05) * 800))
    # High spectral centroid → tension
    centroid_stress = min(100, max(0, (acoustic["spectral_centroid"] - 1500) / 30))

    # Text-based stress (negative polarity = higher stress)
    text_stress = min(100, max(0, (0.5 - polarity) * 80))

    # Weighted combination
    stress_score = int(
        text_stress * 0.35 +
        pitch_stress * 0.20 +
        energy_stress * 0.15 +
        rate_stress * 0.15 +
        centroid_stress * 0.15
    )
    stress_score = min(100, max(0, stress_score))
    recovery_score = max(0, min(100, 100 - stress_score + int(polarity * 20)))

    # Emotion label
    if stress_score >= 70:
        emotion = "stressed"
    elif stress_score >= 50:
        emotion = "tense"
    elif polarity > 0.3:
        emotion = "positive"
    elif polarity < -0.2:
        emotion = "fatigued"
    else:
        emotion = "neutral"

    return {
        "emotion": emotion,
        "stress_score": stress_score,
        "recovery_score": recovery_score,
        "text_polarity": round(polarity, 2),
        "text_subjectivity": round(subjectivity, 2),
    }


def analyse_calendar(events: list) -> dict:
    """Compute calendar load metrics from Google Calendar events."""
    if not events:
        return {
            "meetings_count": 0, "meetings_per_hour": 0.0,
            "back_to_back": 0, "overlapping": 0,
            "avg_gap_mins": 999, "min_gap_mins": 999,
            "meeting_load_score": 0, "recovery_capacity_score": 100,
        }

    meetings = []
    for ev in events:
        start_str = ev.get("start", "")
        end_str = ev.get("end", "")
        if not start_str or not end_str:
            continue
        try:
            start = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
            end = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
            meetings.append((start, end))
        except:
            continue

    meetings.sort(key=lambda x: x[0])
    count = len(meetings)

    if count == 0:
        return {
            "meetings_count": 0, "meetings_per_hour": 0.0,
            "back_to_back": 0, "overlapping": 0,
            "avg_gap_mins": 999, "min_gap_mins": 999,
            "meeting_load_score": 0, "recovery_capacity_score": 100,
        }

    # Time span
    total_hours = max(1, (meetings[-1][1] - meetings[0][0]).total_seconds() / 3600)
    meetings_per_hour = round(count / total_hours, 2)

    # Gaps
    gaps = []
    back_to_back = 0
    overlapping = 0
    for i in range(1, len(meetings)):
        gap = (meetings[i][0] - meetings[i-1][1]).total_seconds() / 60
        gaps.append(gap)
        if gap < 10:
            back_to_back += 1
        if gap < 0:
            overlapping += 1

    avg_gap = round(sum(gaps) / len(gaps), 1) if gaps else 999
    min_gap = round(min(gaps), 1) if gaps else 999

    # Meeting load score (0-100)
    load = min(100, int(
        count * 12 +           # each meeting adds ~12
        back_to_back * 15 +    # back-to-back is heavy
        overlapping * 20 +     # overlapping is worse
        max(0, 50 - avg_gap)   # small gaps add pressure
    ))

    capacity = max(0, 100 - load)

    return {
        "meetings_count": count,
        "meetings_per_hour": meetings_per_hour,
        "back_to_back": back_to_back,
        "overlapping": overlapping,
        "avg_gap_mins": avg_gap,
        "min_gap_mins": min_gap,
        "meeting_load_score": load,
        "recovery_capacity_score": capacity,
    }


async def generate_insight(
    emotion: str, stress: int, recovery: int,
    transcript: str, cal_data: dict,
    sleep_data: dict = None,
    audio_library: list = None,
) -> dict:
    """Generate Nuo's full structured response using production prompt."""
    from nuo_prompts import SYSTEM_PROMPT, build_user_prompt

    api_key = os.environ.get("EMERGENT_LLM_KEY", "")

    # Build context for the production prompt
    sleep = sleep_data or {}
    context = {
        "sleep": {
            "avg_sleep_hours_3d": sleep.get("latest_actual_sleep", None),
            "avg_sleep_debt_hours_3d": sleep.get("avg_debt_3d", None),
            "nights": sleep.get("records", []),
        },
        "calendar": {
            "total_meetings": cal_data.get("meetings_count", 0),
            "back_to_back_meetings": cal_data.get("back_to_back", 0),
            "first_meeting_starts": "N/A",
            "last_meeting_ends": "N/A",
            "busiest_window": "N/A",
            "gaps": [],
            "events_summary": [],
        },
        "biometrics": {
            "voice_stress_3d_avg_sigma": round(stress / 50, 2),
            "recovery_3d_avg_score": recovery,
            "detected_emotion": emotion,
            "linguistic_markers": {},
        },
        "intervention_history": {
            "total_sessions_30d": 0,
            "per_label_stats": {},
            "last_completed_session": None,
            "baseline_recovery_prev_week": None,
        },
        "audio_library": audio_library or [
            {"audio_id": "aud_calm_breath_01", "title": "4-7-8 Breathing", "label": "breathwork", "duration_sec": 600},
            {"audio_id": "aud_ocean_ambient_01", "title": "Ocean Ambient", "label": "calming", "duration_sec": 600},
            {"audio_id": "aud_nsdr_body_scan_02", "title": "NSDR Body Scan", "label": "nsdr", "duration_sec": 600},
            {"audio_id": "aud_forest_01", "title": "Forest Soundscape", "label": "calming", "duration_sec": 600},
            {"audio_id": "aud_focus_binaural_03", "title": "40Hz Focus", "label": "focus", "duration_sec": 600},
        ],
        "pre_scheduled_intervention": None,
    }

    user_prompt = build_user_prompt(
        user_text_original=transcript,
        user_text_english=transcript,
        user_language="en",
        context=context,
    )

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"nuo-{uuid.uuid4().hex[:8]}",
            system_message=SYSTEM_PROMPT,
        ).with_model("openai", "gpt-4o")

        response = await chat.send_message(UserMessage(text=user_prompt))

        # Parse JSON
        text = response.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            text = text.rsplit("```", 1)[0]
        result = json.loads(text)

        # Extract the 3-part insight for backward compat
        spoken = result.get("spoken_response", "")
        status = result.get("status_summary", {})

        return {
            "feeling": spoken[:200] if spoken else f"Voice stress at {round(stress/50,1)} sigma. Recovery at {recovery}.",
            "why": result.get("status_summary", {}).get("assessment", "stable"),
            "actions": result.get("next_checkin", ""),
            "full_response": result,
        }
    except Exception as e:
        logger.error(f"LLM insight error: {e}")
        return {
            "feeling": f"Voice stress elevated. Recovery at {recovery}. {cal_data.get('meetings_count', 0)} meetings today.",
            "why": f"Sleep debt at {sleep.get('avg_debt_3d', 'unknown')} hours avg over 3 days.",
            "actions": "A targeted binaural session could help your nervous system find the reset it needs.",
            "full_response": None,
        }


def score_audio_tracks(stress: int, emotion: str, tracks: list) -> list:
    """Score and rank audio tracks based on stress level and emotion."""
    stress_map = {"low": 30, "medium": 60, "high": 85}
    scored = []
    for track in tracks:
        tag_score = 100 - abs(stress - stress_map.get(track.get("stress_tag", "medium"), 60))
        emotion_tags = track.get("emotion_tag", [])
        emotion_match = 20 if emotion in emotion_tags else 0
        total = tag_score + emotion_match
        scored.append({**track, "_score": total})

    scored.sort(key=lambda x: x["_score"], reverse=True)
    result = []
    for i, t in enumerate(scored[:3]):
        t.pop("_score", None)
        t["recommended"] = (i == 0)
        result.append(t)
    return result
