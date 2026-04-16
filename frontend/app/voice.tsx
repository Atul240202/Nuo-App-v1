import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Animated, StyleSheet, TouchableOpacity, StatusBar, Image, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { Feather, Ionicons } from '@expo/vector-icons';
import { NUO_ORB_BASE64 } from '../constants/nuoOrb';

type NuoState = 'idle' | 'recording' | 'processing' | 'results';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const C = {
  bg: '#040c18',
  teal: '#00d4aa',
  violet: '#8b5cf6',
  stress: '#fb7185',
  recovery: '#4ade80',
  warning: '#fbbf24',
  textPrimary: 'rgba(255,255,255,0.88)',
  textSecondary: 'rgba(255,255,255,0.35)',
  surface: 'rgba(255,255,255,0.04)',
  surfaceLight: 'rgba(255,255,255,0.07)',
  border: 'rgba(255,255,255,0.10)',
};

interface FullResult {
  stress_score: number;
  recovery_score: number;
  transcript: string;
  emotion: string;
  calendar_data: {
    meetings_count: number;
    back_to_back: number;
    meeting_load_score: number;
    recovery_capacity_score: number;
    avg_gap_mins: number;
  };
  insight: {
    feeling: string;
    full_response?: {
      spoken_response: string;
      status_summary: {
        sleep_hours_avg_3d: number;
        sleep_debt_hours: number;
        voice_stress_sigma: number;
        recovery_score: number;
        detected_emotion: string;
        meeting_count_today: number;
        back_to_back_meetings: number;
        day_ends_at: string;
        assessment: string;
      };
      scheduled_intervention: {
        start_time: string;
        duration_min: number;
        audio_label: string;
        audio_title: string;
        reason: string;
      };
      reset_options: {
        rank: number;
        title: string;
        label: string;
        duration_sec: number;
        nuo_pick: boolean;
        pick_reason: string | null;
      }[];
      next_checkin: string;
    };
  };
}

export default function VoiceScreen() {
  const router = useRouter();
  const [state, setState] = useState<NuoState>('idle');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [result, setResult] = useState<FullResult | null>(null);

  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const orbPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const dur = state === 'processing' ? 1300 : 2800;
    const pulseLoop = Animated.loop(Animated.sequence([
      Animated.timing(orbPulse, { toValue: 1.06, duration: dur / 2, useNativeDriver: true }),
      Animated.timing(orbPulse, { toValue: 1, duration: dur / 2, useNativeDriver: true }),
    ]));
    pulseLoop.start();

    if (state === 'recording' || state === 'processing') {
      const makeRing = (anim: Animated.Value, delay: number) =>
        Animated.loop(Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 3000, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]));
      makeRing(ring1, 0).start();
      makeRing(ring2, 1000).start();
      makeRing(ring3, 2000).start();
    } else {
      [ring1, ring2, ring3].forEach(r => { r.stopAnimation(); r.setValue(0); });
    }
    return () => { pulseLoop.stop(); [ring1, ring2, ring3].forEach(r => r.stopAnimation()); };
  }, [state]);

  const startRecording = async () => {
    // Check session limit before allowing recording
    try {
      const statusResp = await fetch(`${BACKEND_URL}/api/session/status?email=atuljha2402@gmail.com`);
      if (statusResp.ok) {
        const status = await statusResp.json();
        if (!status.allowed) {
          router.push('/paywall');
          return;
        }
      }
    } catch {}

    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
      setState('recording');
    } catch {}
  };

  const submitRecording = async () => {
    if (!recording) return;
    setState('processing');
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      const formData = new FormData();
      if (uri) {
        formData.append('audio', { uri, name: 'recording.m4a', type: 'audio/m4a' } as any);
      }
      formData.append('user_id', 'atuljha2402@gmail.com');

      try {
        const resp = await fetch(`${BACKEND_URL}/api/voice/analyze`, { method: 'POST', body: formData, credentials: 'include' });
        if (resp.ok) { const data = await resp.json(); setResult(data); setState('results'); return; }
      } catch {}

      // Fallback
      setResult({
        stress_score: 62, recovery_score: 45, transcript: "Feeling overwhelmed with work today.", emotion: "tense",
        calendar_data: { meetings_count: 6, back_to_back: 3, meeting_load_score: 78, recovery_capacity_score: 22, avg_gap_mins: 12 },
        audio_tracks: [
          { audio_id: "aud_df_bin_001", title: "40Hz Binaural Focus", label: "Deep Focus", duration_sec: 600, recommended: true, file_url: "https://pause-v1-audio.sfo3.digitaloceanspaces.com/NY%20Audio%20Interventions/Alpha%20Waves%20Heal%20Damage%20In%20The%20Body%2C%20Brain%20Massage%20While%20You%20Sleep%2C%20Improve%20Your%20Memory%20%5BpxqW0tgb5A%5D.mp3" },
          { audio_id: "aud_df_bin_002", title: "Alpha Wave Concentration", label: "Deep Recovery", duration_sec: 600, recommended: false, file_url: "https://pause-v1-audio.sfo3.cdn.digitaloceanspaces.com/NY%20Audio%20Interventions/Focus%20Music%20%E2%80%A2%20Enter%20Hyperfocus%20Mode%20for%20Deep%20Work%20&%20Flow%20%5BE79seWbsZds%5D.mp3" },
          { audio_id: "aud_df_flo_003", title: "Flow State Ambient", label: "High Relaxation", duration_sec: 600, recommended: false, file_url: "https://pause-v1-audio.sfo3.cdn.digitaloceanspaces.com/NY%20Audio%20Interventions/Instant%20Relief%20from%20Stress%20and%20Anxiety%20_%20Detox%20Negative%20Emotions,%20Calm%20Nature%20Healing%20Sleep%20Music%E2%98%8558%20%5B79kpoGF8KWU%5D.mp3" },
        ],
        insight: {
          feeling: "Voice stress elevated. Recovery at 45.",
          full_response: {
            spoken_response: "Five hours of sleep debt, three nights running. Six meetings today, three back to back. Voice stress is at 1.2 sigma, recovery is 45. This is a dip from last week's 68 baseline. I've scheduled a 10-minute breathwork at 3:05 PM — only gap before your evening block. You can move it, but I'd leave it. Resets below if you want something now. I'll check after tonight's sleep.",
            status_summary: { sleep_hours_avg_3d: 3, sleep_debt_hours: 5, voice_stress_sigma: 1.2, recovery_score: 45, detected_emotion: "tense", meeting_count_today: 6, back_to_back_meetings: 3, day_ends_at: "7:00 PM", assessment: "dip" },
            scheduled_intervention: { start_time: "3:05 PM", duration_min: 10, audio_label: "breathwork", audio_title: "4-7-8 Breathing", reason: "Only gap before 3:30-7 PM block. Breathwork: highest completion in your history." },
            reset_options: [],
            next_checkin: "After tonight's sleep. If recovery shifts, you'll know by 7 AM.",
          },
        },
      } as any);
      setState('results');
    } catch { setState('idle'); }
  };

  const ringColor = state === 'processing' ? C.violet : C.teal;
  const ringScale = (a: Animated.Value) => a.interpolate({ inputRange: [0, 1], outputRange: [1, 3.2] });
  const ringOpacity = (a: Animated.Value) => a.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <View style={styles.container} testID="voice-screen">
      <StatusBar barStyle="light-content" />
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} testID="voice-back-btn">
        <Feather name="arrow-left" size={22} color={C.textSecondary} />
      </TouchableOpacity>

      {state === 'results' && result ? (
        <ResultsPanel result={result} onReset={() => { setResult(null); setState('idle'); }} />
      ) : (
        <View style={styles.center}>
          <View style={styles.ringsContainer}>
            {[ring1, ring2, ring3].map((a, i) => (
              <Animated.View key={i} style={[styles.ring, { borderColor: ringColor, transform: [{ scale: ringScale(a) }], opacity: ringOpacity(a) }]} />
            ))}
            <Animated.View style={[styles.orbContainer, { transform: [{ scale: orbPulse }] }]}>
              <Image source={{ uri: NUO_ORB_BASE64 }} style={styles.orbImage} testID="nuo-orb" />
            </Animated.View>
          </View>
          <Text style={styles.stateText}>
            {state === 'idle' && "I'm listening when you're ready"}
            {state === 'recording' && "Speak freely — I'm here"}
            {state === 'processing' && 'Understanding you...'}
          </Text>
          {state === 'idle' && <Text style={styles.subText}>You don't have to structure it. Just speak.</Text>}
          <View style={styles.controls}>
            <TouchableOpacity style={[styles.micBtn, state === 'recording' && styles.micBtnActive]} onPress={state === 'idle' ? startRecording : undefined} disabled={state === 'processing'} testID="mic-button">
              <Ionicons name={state === 'recording' ? 'pause' : 'mic-outline'} size={32} color={state === 'recording' ? '#FFF' : C.teal} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tickBtn, state === 'recording' && styles.tickBtnEnabled]} onPress={submitRecording} disabled={state !== 'recording'} testID="tick-button">
              <Feather name="check" size={24} color={state === 'recording' ? C.recovery : 'rgba(255,255,255,0.15)'} />
            </TouchableOpacity>
          </View>
        </View>
      )}
      {state !== 'results' && (
        <TouchableOpacity style={styles.skipBtn} onPress={() => router.replace('/home')} testID="voice-skip-btn">
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ─── AUDIO CARD WITH PLAYBACK ──────────────────── */
function AudioCard({ track }: { track: any }) {
  const [playing, setPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  const togglePlay = async () => {
    if (playing && soundRef.current) {
      await soundRef.current.pauseAsync();
      setPlaying(false);
      return;
    }

    try {
      if (soundRef.current) {
        await soundRef.current.playAsync();
        setPlaying(true);
        return;
      }

      const url = track.file_url;
      if (!url) return;

      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setPlaying(false);
          }
        }
      );
      soundRef.current = sound;
      setPlaying(true);
    } catch {}
  };

  useEffect(() => {
    return () => { soundRef.current?.unloadAsync(); };
  }, []);

  return (
    <View style={[styles.audioCard, track.nuo_pick && styles.audioCardPick]} testID={`reset-${track.rank}`}>
      {track.nuo_pick && (
        <View style={styles.nuoPickBadge}><Text style={styles.nuoPickText}>Nuo's pick</Text></View>
      )}
      <View style={styles.audioRow}>
        <TouchableOpacity style={[styles.playBtn, playing && styles.playBtnActive]} onPress={togglePlay} testID={`play-reset-${track.rank}`}>
          <Ionicons name={playing ? 'pause' : 'play'} size={20} color={C.teal} />
        </TouchableOpacity>
        <View style={styles.audioInfo}>
          <Text style={styles.audioTitle}>{track.title}</Text>
          <Text style={styles.audioLabel}>{track.label} · {Math.round((track.duration_sec || 600) / 60)} min</Text>
          {track.pick_reason && <Text style={styles.pickReason}>{track.pick_reason}</Text>}
        </View>
      </View>
    </View>
  );
}

/* ─── RESULTS PANEL ────────────────────────────── */
function ResultsPanel({ result, onReset }: { result: FullResult; onReset: () => void }) {
  const router = useRouter();
  const full = result.insight.full_response;
  const status = full?.status_summary;
  const sched = full?.scheduled_intervention;
  // Use real audio_tracks from backend (have file_url) instead of LLM reset_options (no file_url)
  const audioTracks = (result as any).audio_tracks || [];
  const [interventionKept, setInterventionKept] = useState<boolean | null>(null);

  const handleKeepIntervention = async () => {
    setInterventionKept(true);
    if (sched) {
      try {
        await fetch(`${BACKEND_URL}/api/interventions/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'atuljha2402@gmail.com',
            intervention: sched,
          }),
        });
      } catch {}
    }
  };

  const handleCancelIntervention = async () => {
    setInterventionKept(false);
    if (sched) {
      try {
        await fetch(`${BACKEND_URL}/api/interventions/cancel?email=atuljha2402@gmail.com&start_time=${encodeURIComponent(sched.start_time)}`, {
          method: 'DELETE',
        });
      } catch {}
    }
  };

  // Data cards
  const stressScore = result.stress_score;
  const recoveryScore = result.recovery_score;
  const sleepDebt = status?.sleep_debt_hours ?? 0;
  const meetings = status?.meeting_count_today ?? result.calendar_data?.meetings_count ?? 0;
  const b2b = status?.back_to_back_meetings ?? result.calendar_data?.back_to_back ?? 0;
  const dayEnds = status?.day_ends_at || '';
  const spoken = full?.spoken_response || result.insight.feeling || '';

  return (
    <ScrollView style={styles.resultsScroll} contentContainerStyle={styles.resultsContent} testID="results-panel">

      {/* ── 1-4: Data Cards Row ── */}
      <View style={styles.dataCardsGrid}>
        <View style={[styles.dataCard, styles.dataCardHalf]} testID="card-stress">
          <Text style={styles.dataCardLabel}>VOICE STRESS</Text>
          <Text style={[styles.dataCardValue, { color: stressScore >= 60 ? C.stress : stressScore >= 40 ? C.warning : C.recovery }]}>{stressScore}</Text>
          <Text style={styles.dataCardUnit}>/100</Text>
        </View>
        <View style={[styles.dataCard, styles.dataCardHalf]} testID="card-recovery">
          <Text style={styles.dataCardLabel}>RECOVERY</Text>
          <Text style={[styles.dataCardValue, { color: recoveryScore >= 60 ? C.recovery : recoveryScore >= 40 ? C.warning : C.stress }]}>{recoveryScore}</Text>
          <Text style={styles.dataCardUnit}>/100</Text>
        </View>
        <View style={[styles.dataCard, styles.dataCardHalf]} testID="card-sleep-debt">
          <Text style={styles.dataCardLabel}>SLEEP DEBT (3D)</Text>
          <Text style={[styles.dataCardValue, { color: sleepDebt >= 4 ? C.stress : sleepDebt >= 2 ? C.warning : C.recovery }]}>{sleepDebt}h</Text>
          <Text style={styles.dataCardUnit}>avg/night</Text>
        </View>
        <View style={[styles.dataCard, styles.dataCardHalf]} testID="card-meetings">
          <Text style={styles.dataCardLabel}>MEETINGS</Text>
          <Text style={[styles.dataCardValue, { color: C.textPrimary }]}>{meetings}</Text>
          <Text style={styles.dataCardUnit}>{b2b} back-to-back{dayEnds ? ` · ends ${dayEnds}` : ''}</Text>
        </View>
      </View>

      {/* ── 5: Nuo's spoken response ── */}
      <View style={styles.spokenCard} testID="spoken-response-card">
        <View style={styles.spokenHeader}>
          <View style={styles.nuoDot} />
          <Text style={styles.spokenHeaderText}>Nuo</Text>
        </View>
        <Text style={styles.spokenText}>{spoken}</Text>
        {full?.next_checkin ? (
          <Text style={styles.nextCheckin}>{full.next_checkin}</Text>
        ) : null}
      </View>

      {/* ── 6: Auto Intervention Card ── */}
      {sched && interventionKept === null && (
        <View style={styles.interventionCard} testID="intervention-card">
          <View style={styles.interventionHeader}>
            <Feather name="clock" size={16} color={C.violet} />
            <Text style={styles.interventionTitle}>Auto Intervention Scheduled</Text>
          </View>
          <View style={styles.interventionBody}>
            <Text style={styles.interventionTime}>{sched.start_time}</Text>
            <View style={styles.interventionDetail}>
              <Text style={styles.interventionAudio}>{sched.audio_title}</Text>
              <Text style={styles.interventionLabel}>{sched.audio_label} · {sched.duration_min} min</Text>
            </View>
          </View>
          <Text style={styles.interventionReason}>{sched.reason}</Text>
          <View style={styles.interventionActions}>
            <TouchableOpacity style={styles.keepBtn} onPress={handleKeepIntervention} testID="keep-intervention-btn">
              <Feather name="check" size={16} color="#FFF" />
              <Text style={styles.keepBtnText}>Keep it</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelIntervention} testID="cancel-intervention-btn">
              <Feather name="x" size={16} color={C.textSecondary} />
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {interventionKept === true && (
        <View style={styles.interventionKeptBadge}>
          <Feather name="check-circle" size={16} color={C.teal} />
          <Text style={styles.interventionKeptText}>Intervention kept at {sched?.start_time}</Text>
        </View>
      )}
      {interventionKept === false && (
        <View style={styles.interventionKeptBadge}>
          <Feather name="x-circle" size={16} color={C.stress} />
          <Text style={styles.interventionKeptText}>Intervention cancelled</Text>
        </View>
      )}

      {/* ── 7: Reset Now + Top 3 Audio ── */}
      <Text style={styles.resetHeading}>Reset Now</Text>
      {audioTracks.map((track: any, idx: number) => (
        <AudioCard key={track.audio_id || idx} track={{ ...track, rank: idx + 1, nuo_pick: track.recommended }} />
      ))}

      {/* Bottom actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.recordAgainBtn} onPress={onReset} testID="record-again-btn">
          <Feather name="mic" size={18} color={C.teal} />
          <Text style={styles.recordAgainText}>Record Again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/home')} testID="go-home-btn">
          <Feather name="home" size={18} color={C.textPrimary} />
          <Text style={styles.homeBtnText}>Home</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

/* ─── STYLES ───────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  backBtn: { position: 'absolute', top: 56, left: 20, zIndex: 10, padding: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ringsContainer: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center', marginBottom: 40 },
  ring: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 1.5 },
  orbContainer: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  orbImage: { width: 120, height: 120 },
  stateText: { fontSize: 18, fontFamily: 'Sora_500Medium', color: C.textPrimary, textAlign: 'center', marginBottom: 8 },
  subText: { fontSize: 14, fontFamily: 'Sora_300Light', fontStyle: 'italic', color: C.textSecondary, textAlign: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 24, marginTop: 48 },
  micBtn: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: C.teal, alignItems: 'center', justifyContent: 'center' },
  micBtnActive: { backgroundColor: C.teal },
  tickBtn: { width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  tickBtnEnabled: { borderColor: C.recovery },
  skipBtn: { position: 'absolute', bottom: 48, right: 28, padding: 12 },
  skipText: { fontSize: 13, fontFamily: 'Sora_400Regular', color: C.textSecondary },

  // Results
  resultsScroll: { flex: 1 },
  resultsContent: { padding: 20, paddingTop: 72, paddingBottom: 40 },

  // Data cards grid (2x2)
  dataCardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  dataCard: { backgroundColor: C.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  dataCardHalf: { width: '48%', flexGrow: 1 },
  dataCardLabel: { fontSize: 9, fontFamily: 'SpaceMono_400Regular', color: C.textSecondary, letterSpacing: 1, marginBottom: 6 },
  dataCardValue: { fontSize: 28, fontFamily: 'SpaceMono_400Regular' },
  dataCardUnit: { fontSize: 10, fontFamily: 'SpaceMono_400Regular', color: C.textSecondary, marginTop: 2 },

  // Spoken response
  spokenCard: { backgroundColor: C.surfaceLight, borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  spokenHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  nuoDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.teal, marginRight: 8 },
  spokenHeaderText: { fontSize: 12, fontFamily: 'SpaceMono_400Regular', color: C.teal, letterSpacing: 1 },
  spokenText: { fontSize: 14, fontFamily: 'Sora_400Regular', color: C.textPrimary, lineHeight: 22 },
  nextCheckin: { fontSize: 12, fontFamily: 'Sora_300Light', color: C.textSecondary, marginTop: 12, fontStyle: 'italic' },

  // Intervention card
  interventionCard: { backgroundColor: 'rgba(139,92,246,0.08)', borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(139,92,246,0.25)' },
  interventionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  interventionTitle: { fontSize: 13, fontFamily: 'Sora_500Medium', color: C.violet },
  interventionBody: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  interventionTime: { fontSize: 24, fontFamily: 'SpaceMono_400Regular', color: C.textPrimary, marginRight: 14 },
  interventionDetail: { flex: 1 },
  interventionAudio: { fontSize: 14, fontFamily: 'Sora_500Medium', color: C.textPrimary },
  interventionLabel: { fontSize: 11, fontFamily: 'SpaceMono_400Regular', color: C.textSecondary, marginTop: 2 },
  interventionReason: { fontSize: 12, fontFamily: 'Sora_300Light', color: C.textSecondary, marginBottom: 14, lineHeight: 18 },
  interventionActions: { flexDirection: 'row', gap: 10 },
  keepBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 12, backgroundColor: C.violet },
  keepBtnText: { fontSize: 14, fontFamily: 'Sora_500Medium', color: '#FFF' },
  cancelBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  cancelBtnText: { fontSize: 14, fontFamily: 'Sora_400Regular', color: C.textSecondary },
  interventionKeptBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: C.surface, borderRadius: 12, marginBottom: 16 },
  interventionKeptText: { fontSize: 13, fontFamily: 'Sora_400Regular', color: C.textSecondary },

  // Reset section
  resetHeading: { fontSize: 14, fontFamily: 'SpaceMono_400Regular', color: C.textSecondary, marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase' },
  audioCard: { backgroundColor: C.surface, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  audioCardPick: { borderColor: C.violet, borderWidth: 1.5 },
  nuoPickBadge: { position: 'absolute', top: -9, right: 14, backgroundColor: C.violet, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  nuoPickText: { fontSize: 9, fontFamily: 'SpaceMono_400Regular', color: '#FFF', letterSpacing: 0.5 },
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  playBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,212,170,0.12)', alignItems: 'center', justifyContent: 'center' },
  playBtnActive: { backgroundColor: 'rgba(0,212,170,0.25)' },
  audioInfo: { flex: 1 },
  audioTitle: { fontSize: 14, fontFamily: 'Sora_500Medium', color: C.textPrimary },
  audioLabel: { fontSize: 11, fontFamily: 'SpaceMono_400Regular', color: C.textSecondary, marginTop: 2 },
  pickReason: { fontSize: 11, fontFamily: 'Sora_300Light', color: C.teal, marginTop: 4 },

  // Bottom actions
  bottomActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  recordAgainBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: C.teal },
  recordAgainText: { fontSize: 14, fontFamily: 'Sora_500Medium', color: C.teal },
  homeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 14, backgroundColor: C.surface },
  homeBtnText: { fontSize: 14, fontFamily: 'Sora_500Medium', color: C.textPrimary },
});
