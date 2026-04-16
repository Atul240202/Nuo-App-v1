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


def compute_calendar_context(cal_events_full: list, cal_data: dict) -> dict:
    """
    Compute real time-stamped gaps, event summaries, busiest window
    from actual Google Calendar events so the LLM never hallucinates.
    """
    if not cal_events_full:
        return {
            "total_meetings": 0,
            "back_to_back_meetings": 0,
            "first_meeting_starts": "No meetings today",
            "last_meeting_ends": "No meetings today",
            "busiest_window": "No meetings today",
            "gaps": ["Entire day is free"],
            "events_summary": [],
        }

    # Parse events into (start_dt, end_dt, title) tuples
    parsed = []
    for ev in cal_events_full:
        try:
            s = datetime.fromisoformat(ev["start"].replace("Z", "+00:00"))
            e = datetime.fromisoformat(ev["end"].replace("Z", "+00:00"))
            parsed.append((s, e, ev.get("title", "Meeting")))
        except Exception:
            continue

    if not parsed:
        return {
            "total_meetings": cal_data.get("meetings_count", 0),
            "back_to_back_meetings": cal_data.get("back_to_back", 0),
            "first_meeting_starts": "N/A",
            "last_meeting_ends": "N/A",
            "busiest_window": "N/A",
            "gaps": [],
            "events_summary": [],
        }

    parsed.sort(key=lambda x: x[0])

    def fmt_time(dt):
        """Format datetime to human-readable like '2:30 PM'"""
        return dt.strftime("%-I:%M %p") if hasattr(dt, 'strftime') else str(dt)

    # Event summaries for LLM
    events_summary = []
    for s, e, title in parsed:
        dur_min = int((e - s).total_seconds() / 60)
        events_summary.append(f"{fmt_time(s)} - {fmt_time(e)}: {title} ({dur_min} min)")

    first_start = fmt_time(parsed[0][0])
    last_end = fmt_time(parsed[-1][1])

    # Compute real time-stamped gaps (>= 15 min)
    gaps = []
    now = datetime.now(timezone.utc)

    # Gap before first meeting (from now)
    if parsed[0][0] > now:
        gap_min = int((parsed[0][0] - now).total_seconds() / 60)
        if gap_min >= 15:
            gaps.append(f"NOW - {fmt_time(parsed[0][0])} ({gap_min} min free)")

    # Gaps between meetings
    for i in range(1, len(parsed)):
        gap_start = parsed[i - 1][1]
        gap_end = parsed[i][0]
        gap_min = int((gap_end - gap_start).total_seconds() / 60)
        if gap_min >= 15:
            gaps.append(f"{fmt_time(gap_start)} - {fmt_time(gap_end)} ({gap_min} min free)")

    # Gap after last meeting (until end of day ~9 PM)
    eod = parsed[-1][1].replace(hour=21, minute=0, second=0)
    after_last_gap = int((eod - parsed[-1][1]).total_seconds() / 60)
    if after_last_gap >= 15:
        gaps.append(f"{fmt_time(parsed[-1][1])} - 9:00 PM ({after_last_gap} min free)")

    if not gaps:
        gaps.append("No gaps >= 15 min available today")

    # Busiest window: find 2-hour window with most meetings
    busiest_window = "N/A"
    if len(parsed) >= 2:
        max_count = 0
        best_window = ""
        for i, (s, e, _) in enumerate(parsed):
            window_end = s + timedelta(hours=2)
            count = sum(1 for ps, pe, _ in parsed if ps >= s and ps < window_end)
            if count > max_count:
                max_count = count
                best_window = f"{fmt_time(s)} - {fmt_time(window_end)} ({count} meetings)"
        busiest_window = best_window

    return {
        "total_meetings": len(parsed),
        "back_to_back_meetings": cal_data.get("back_to_back", 0),
        "first_meeting_starts": first_start,
        "last_meeting_ends": last_end,
        "busiest_window": busiest_window,
        "gaps": gaps,
        "events_summary": events_summary,
    }


def compute_urgency_tier(stress: int, recovery: int, sleep_data: dict) -> tuple:
    """
    Pre-compute urgency tier based on stress score, recovery, and sleep.
    Returns (tier, signals) where tier is 'high', 'moderate', or 'low'.
    High stress → immediate/earliest intervention.
    Low stress → relaxed later scheduling.
    """
    sleep_debt = sleep_data.get("avg_debt_3d", 0) if sleep_data else 0
    stress_sigma = round(stress / 50, 2)

    signals = []
    if stress >= 70:
        signals.append(f"stress_score={stress} (HIGH, >=70)")
    elif stress >= 50:
        signals.append(f"stress_score={stress} (elevated, >=50)")
    if recovery < 35:
        signals.append(f"recovery={recovery} (critical, <35)")
    elif recovery < 50:
        signals.append(f"recovery={recovery} (low, <50)")
    if sleep_debt and sleep_debt >= 4:
        signals.append(f"sleep_debt={sleep_debt}h (significant, >=4h)")

    # Tier logic: stress-score driven primarily
    if stress >= 70 or (recovery < 35 and stress >= 50):
        tier = "high"
    elif stress >= 45 or recovery < 50 or (sleep_debt and sleep_debt >= 3):
        tier = "moderate"
    else:
        tier = "low"

    return tier, signals


async def generate_insight(
    emotion: str, stress: int, recovery: int,
    transcript: str, cal_data: dict,
    sleep_data: dict = None,
    audio_library: list = None,
    cal_events_full: list = None,
) -> dict:
    """Generate Nuo's full structured response using production prompt with REAL data."""
    from nuo_prompts import SYSTEM_PROMPT, build_user_prompt

    api_key = os.environ.get("EMERGENT_LLM_KEY", "")

    # Build REAL calendar context from actual events
    calendar_context = compute_calendar_context(cal_events_full or [], cal_data)

    # Pre-compute urgency tier (stress-driven)
    urgency_tier, urgency_signals = compute_urgency_tier(stress, recovery, sleep_data)

    # Build real audio library for LLM (use DB tracks, not fake ones)
    real_audio_lib = audio_library or []
    if not real_audio_lib:
        real_audio_lib = [
            {"audio_id": "aud_df_bin_001", "title": "40Hz Binaural Focus", "label": "Deep Focus", "duration_sec": 600},
            {"audio_id": "aud_df_bin_002", "title": "Alpha Wave Concentration", "label": "Deep Recovery", "duration_sec": 600},
            {"audio_id": "aud_df_flo_003", "title": "Flow State Ambient", "label": "High Relaxation", "duration_sec": 600},
        ]

    sleep = sleep_data or {}
    context = {
        "sleep": {
            "avg_sleep_hours_3d": sleep.get("latest_actual_sleep", None),
            "avg_sleep_debt_hours_3d": sleep.get("avg_debt_3d", None),
            "nights": sleep.get("records", []),
        },
        "calendar": calendar_context,
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
        "audio_library": real_audio_lib,
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
    """Score and rank audio tracks based on stress level and emotion. Return random subset."""
    import random
    stress_map = {"low": 30, "medium": 60, "high": 85}
    scored = []
    for track in tracks:
        tag_score = 100 - abs(stress - stress_map.get(track.get("stress_tag", "medium"), 60))
        emotion_tags = track.get("emotion_tag", [])
        emotion_match = 20 if emotion in emotion_tags else 0
        total = tag_score + emotion_match + random.randint(0, 15)
        scored.append({**track, "_score": total})

    scored.sort(key=lambda x: x["_score"], reverse=True)
    result = []
    for i, t in enumerate(scored[:3]):
        t.pop("_score", None)
        t["recommended"] = (i == 0)
        result.append(t)
    return result
