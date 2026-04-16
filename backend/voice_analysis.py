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
    transcript: str, cal_data: dict
) -> dict:
    """Generate Nuo's 3-part insight using GPT-4o via Emergent key."""
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")

    system_prompt = """You are Nuo — a grounded, emotionally intelligent system.
You produce exactly 3 fields in JSON. No markdown. No affirmations. No toxic positivity.
Just clear observation + honest framing + one concrete action.

IMPORTANT: The user may speak in Indian languages including Hindi, Marathi, Kannada, Gujarati, or Tamil.
- If the transcript is in any Indian language, understand it natively — do NOT ask for translation.
- Always respond in English regardless of the input language.
- Understand cultural context, idioms, and emotional expressions specific to Indian languages.

Return ONLY valid JSON with these 3 keys:
- "feeling": 1 sentence describing what you observe in their voice/state. Grounded. No cheerleading.
- "why": 1-2 sentences connecting the voice data to the calendar pattern. Use the numbers.
- "actions": 1 sentence framing why a binaural audio session would help right now. Not listing options."""

    user_prompt = f"""Voice analysis results:
- Emotion detected: {emotion}
- Stress score: {stress}/100
- Recovery score: {recovery}/100
- Transcript: "{transcript}"

Calendar metrics today:
- Meetings: {cal_data.get('meetings_count', 0)}
- Back-to-back: {cal_data.get('back_to_back', 0)}
- Average gap: {cal_data.get('avg_gap_mins', 'N/A')} minutes
- Meeting load score: {cal_data.get('meeting_load_score', 0)}/100
- Recovery capacity: {cal_data.get('recovery_capacity_score', 100)}/100

Generate the 3-part JSON insight. Return ONLY the JSON object, no other text."""

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"nuo-insight-{uuid.uuid4().hex[:8]}",
            system_message=system_prompt,
        ).with_model("openai", "gpt-4o")

        response = await chat.send_message(UserMessage(text=user_prompt))

        # Parse JSON from response
        text = response.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            text = text.rsplit("```", 1)[0]
        result = json.loads(text)
        return {
            "feeling": result.get("feeling", ""),
            "why": result.get("why", ""),
            "actions": result.get("actions", ""),
        }
    except Exception as e:
        logger.error(f"LLM insight error: {e}")
        return {
            "feeling": f"Your voice suggests {emotion} energy with a stress level of {stress}%.",
            "why": f"With {cal_data.get('meetings_count', 0)} meetings and limited gaps, your system hasn't had space to decompress.",
            "actions": "A targeted binaural session could help your nervous system find the reset it needs.",
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
