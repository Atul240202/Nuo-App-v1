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
  border: 'rgba(255,255,255,0.10)',
};

interface VoiceResult {
  stress_score: number;
  recovery_score: number;
  meeting_load_score: number;
  capacity_left: number;
  transcript: string;
  insight: { feeling: string; why: string; actions: string };
  audio_tracks: { id: string; title: string; desc: string; duration: string; recommended: boolean }[];
}

export default function VoiceScreen() {
  const router = useRouter();
  const [state, setState] = useState<NuoState>('idle');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [result, setResult] = useState<VoiceResult | null>(null);

  // Animations
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const orbPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Mascot pulse - always on
    const pulseDuration = state === 'processing' ? 1300 : 2800;
    const pulseLoop = Animated.loop(Animated.sequence([
      Animated.timing(orbPulse, { toValue: 1.06, duration: pulseDuration / 2, useNativeDriver: true }),
      Animated.timing(orbPulse, { toValue: 1, duration: pulseDuration / 2, useNativeDriver: true }),
    ]));
    pulseLoop.start();

    // Rings - active during recording + processing
    if (state === 'recording' || state === 'processing') {
      const makeRing = (anim: Animated.Value, delay: number) =>
        Animated.loop(Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(anim, { toValue: 1, duration: 3000, useNativeDriver: true }),
          ]),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]));
      makeRing(ring1, 0).start();
      makeRing(ring2, 1000).start();
      makeRing(ring3, 2000).start();
    } else {
      [ring1, ring2, ring3].forEach(r => { r.stopAnimation(); r.setValue(0); });
    }

    return () => {
      pulseLoop.stop();
      [ring1, ring2, ring3].forEach(r => r.stopAnimation());
    };
  }, [state]);

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      setState('recording');
    } catch { /* ignore */ }
  };

  const pauseRecording = async () => {
    if (!recording) return;
    try {
      await recording.pauseAsync();
    } catch { /* ignore */ }
  };

  const submitRecording = async () => {
    if (!recording) return;
    setState('processing');
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      // Send to backend for analysis
      const formData = new FormData();
      if (uri) {
        const fileType = uri.endsWith('.m4a') ? 'audio/m4a' : 'audio/wav';
        formData.append('audio', { uri, name: 'recording.m4a', type: fileType } as any);
      }
      formData.append('user_id', 'atuljha2402@gmail.com');

      try {
        const resp = await fetch(`${BACKEND_URL}/api/voice/analyze`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
        if (resp.ok) {
          const data = await resp.json();
          setResult(data);
          setState('results');
          return;
        }
      } catch { /* fallback */ }

      // Fallback mock result
      setResult({
        stress_score: 62,
        recovery_score: 45,
        meeting_load_score: 78,
        capacity_left: 30,
        transcript: "I've been in back-to-back meetings all day and I can feel the tension building up.",
        insight: {
          feeling: "Your voice carries fatigue with an undercurrent of tension.",
          why: "6 meetings today with only 8 minutes average gap — your nervous system hasn't had a chance to downshift.",
          actions: "A theta-wave session could help your body catch the reset it's been missing.",
        },
        audio_tracks: [
          { id: '1', title: 'Deep Ocean Theta', desc: '4.5Hz binaural + ocean waves', duration: '10:00', recommended: true },
          { id: '2', title: 'Forest Rain Reset', desc: '6Hz theta + rain ambience', duration: '10:00', recommended: false },
          { id: '3', title: 'Silent Valley', desc: '5Hz binaural + white noise', duration: '10:00', recommended: false },
        ],
      });
      setState('results');
    } catch {
      setState('idle');
    }
  };

  const handleMicPress = () => {
    if (state === 'idle') startRecording();
    else if (state === 'recording') pauseRecording();
  };

  const handleReset = () => {
    setResult(null);
    setState('idle');
  };

  const ringColor = state === 'processing' ? C.violet : C.teal;
  const ringScale = (anim: Animated.Value) => anim.interpolate({ inputRange: [0, 1], outputRange: [1, 3.2] });
  const ringOpacity = (anim: Animated.Value) => anim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <View style={styles.container} testID="voice-screen">
      <StatusBar barStyle="light-content" />

      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} testID="voice-back-btn">
        <Feather name="arrow-left" size={22} color={C.textSecondary} />
      </TouchableOpacity>

      {state === 'results' && result ? (
        <ResultsPanel result={result} onReset={handleReset} />
      ) : (
        <View style={styles.center}>
          {/* Rings */}
          <View style={styles.ringsContainer}>
            {[ring1, ring2, ring3].map((anim, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.ring,
                  {
                    borderColor: ringColor,
                    transform: [{ scale: ringScale(anim) }],
                    opacity: ringOpacity(anim),
                  },
                ]}
              />
            ))}
            {/* Orb mascot */}
            <Animated.View style={[styles.orbContainer, { transform: [{ scale: orbPulse }] }]}>
              <Image source={{ uri: NUO_ORB_BASE64 }} style={styles.orbImage} testID="nuo-orb" />
            </Animated.View>
          </View>

          {/* State text */}
          <Text style={styles.stateText}>
            {state === 'idle' && "I'm listening when you're ready"}
            {state === 'recording' && "Speak freely — I'm here"}
            {state === 'processing' && 'Understanding you...'}
          </Text>
          {state === 'idle' && (
            <Text style={styles.subText}>You don't have to structure it. Just speak.</Text>
          )}

          {/* Controls */}
          <View style={styles.controls}>
            {/* Mic button */}
            <TouchableOpacity
              style={[
                styles.micBtn,
                state === 'recording' && styles.micBtnActive,
              ]}
              onPress={handleMicPress}
              disabled={state === 'processing'}
              testID="mic-button"
            >
              <Ionicons
                name={state === 'recording' ? 'pause' : 'mic-outline'}
                size={32}
                color={state === 'recording' ? '#FFF' : C.teal}
              />
            </TouchableOpacity>

            {/* Tick / Submit button */}
            <TouchableOpacity
              style={[
                styles.tickBtn,
                state === 'recording' && styles.tickBtnEnabled,
              ]}
              onPress={submitRecording}
              disabled={state !== 'recording'}
              testID="tick-button"
            >
              <Feather
                name="check"
                size={24}
                color={state === 'recording' ? C.recovery : 'rgba(255,255,255,0.15)'}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Skip */}
      {state !== 'results' && (
        <TouchableOpacity style={styles.skipBtn} onPress={() => router.replace('/home')} testID="voice-skip-btn">
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ─── RESULTS PANEL ────────────────────────────── */
function ResultsPanel({ result, onReset }: { result: VoiceResult; onReset: () => void }) {
  const router = useRouter();

  const scores = [
    { label: 'Stress', value: result.stress_score, color: C.stress },
    { label: 'Recovery', value: result.recovery_score, color: C.recovery },
    { label: 'Meeting Load', value: result.meeting_load_score, color: C.warning },
    { label: 'Capacity', value: result.capacity_left, color: C.teal },
  ];

  return (
    <ScrollView style={styles.resultsScroll} contentContainerStyle={styles.resultsContent} testID="results-panel">
      {/* Score pills */}
      <View style={styles.scoresRow}>
        {scores.map((s) => (
          <View key={s.label} style={styles.scorePill} testID={`score-${s.label.toLowerCase()}`}>
            <Text style={[styles.scoreValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.scoreLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Transcript */}
      <View style={styles.transcriptChip} testID="transcript-chip">
        <Text style={styles.transcriptText}>"{result.transcript}"</Text>
      </View>

      {/* Insight card */}
      <View style={styles.insightCard} testID="insight-card">
        <Text style={styles.insightSection}>{result.insight.feeling}</Text>
        <View style={styles.insightDivider} />
        <Text style={styles.insightSection}>{result.insight.why}</Text>
        <View style={styles.insightDivider} />
        <Text style={styles.insightSection}>{result.insight.actions}</Text>
      </View>

      {/* Audio cards */}
      <Text style={styles.audioHeading}>Recovery Sessions</Text>
      {result.audio_tracks.map((track) => (
        <View
          key={track.id}
          style={[styles.audioCard, track.recommended && styles.audioCardRecommended]}
          testID={`audio-card-${track.id}`}
        >
          {track.recommended && (
            <View style={styles.nuoPickBadge}>
              <Text style={styles.nuoPickText}>Nuo's pick</Text>
            </View>
          )}
          <View style={styles.audioRow}>
            <TouchableOpacity style={styles.playBtn} testID={`play-${track.id}`}>
              <Ionicons name="play" size={20} color={C.teal} />
            </TouchableOpacity>
            <View style={styles.audioInfo}>
              <Text style={styles.audioTitle}>{track.title}</Text>
              <Text style={styles.audioDesc}>{track.desc}</Text>
            </View>
            <Text style={styles.audioDuration}>{track.duration}</Text>
          </View>
          <View style={styles.feedbackRow}>
            <TouchableOpacity style={styles.feedbackBtn} testID={`like-${track.id}`}>
              <Feather name="thumbs-up" size={16} color={C.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.feedbackBtn} testID={`dislike-${track.id}`}>
              <Feather name="thumbs-down" size={16} color={C.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {/* Action buttons */}
      <View style={styles.resultActions}>
        <TouchableOpacity style={styles.resetBtn} onPress={onReset} testID="reset-btn">
          <Feather name="mic" size={18} color={C.teal} />
          <Text style={styles.resetBtnText}>Record Again</Text>
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

  // Rings + Orb
  ringsContainer: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center', marginBottom: 40 },
  ring: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 1.5 },
  orbContainer: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  orbImage: { width: 120, height: 120 },

  // State text
  stateText: { fontSize: 18, fontFamily: 'Sora_500Medium', color: C.textPrimary, textAlign: 'center', marginBottom: 8 },
  subText: { fontSize: 14, fontFamily: 'Sora_300Light', fontStyle: 'italic', color: C.textSecondary, textAlign: 'center' },

  // Controls
  controls: { flexDirection: 'row', alignItems: 'center', gap: 24, marginTop: 48 },
  micBtn: {
    width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: C.teal,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent',
  },
  micBtnActive: { backgroundColor: C.teal, borderColor: C.teal },
  tickBtn: {
    width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  tickBtnEnabled: { borderColor: C.recovery },

  // Skip
  skipBtn: { position: 'absolute', bottom: 48, right: 28, padding: 12 },
  skipText: { fontSize: 13, fontFamily: 'Sora_400Regular', color: C.textSecondary },

  // Results
  resultsScroll: { flex: 1 },
  resultsContent: { padding: 24, paddingTop: 80, paddingBottom: 40 },
  scoresRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  scorePill: {
    flex: 1, backgroundColor: C.surface, borderRadius: 14, paddingVertical: 12,
    alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },
  scoreValue: { fontSize: 22, fontFamily: 'SpaceMono_400Regular' },
  scoreLabel: { fontSize: 10, fontFamily: 'SpaceMono_400Regular', color: C.textSecondary, marginTop: 4, textTransform: 'uppercase' },

  transcriptChip: {
    backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: C.border,
  },
  transcriptText: { fontSize: 14, fontFamily: 'Sora_300Light', fontStyle: 'italic', color: C.textPrimary, lineHeight: 22 },

  insightCard: {
    backgroundColor: C.surface, borderRadius: 16, padding: 20, marginBottom: 24,
    borderWidth: 1, borderColor: C.border,
  },
  insightSection: { fontSize: 14, fontFamily: 'Sora_400Regular', color: C.textPrimary, lineHeight: 22 },
  insightDivider: { height: 1, backgroundColor: C.border, marginVertical: 12 },

  audioHeading: { fontSize: 14, fontFamily: 'SpaceMono_400Regular', color: C.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  audioCard: {
    backgroundColor: C.surface, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: C.border,
  },
  audioCardRecommended: { borderColor: C.violet, borderWidth: 1.5 },
  nuoPickBadge: {
    position: 'absolute', top: -10, right: 12, backgroundColor: C.violet,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8,
  },
  nuoPickText: { fontSize: 10, fontFamily: 'SpaceMono_400Regular', color: '#FFF' },
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  playBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,212,170,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  audioInfo: { flex: 1 },
  audioTitle: { fontSize: 14, fontFamily: 'Sora_500Medium', color: C.textPrimary },
  audioDesc: { fontSize: 12, fontFamily: 'Sora_300Light', color: C.textSecondary, marginTop: 2 },
  audioDuration: { fontSize: 12, fontFamily: 'SpaceMono_400Regular', color: C.textSecondary },
  feedbackRow: { flexDirection: 'row', gap: 12, marginTop: 10, paddingLeft: 52 },
  feedbackBtn: { padding: 6 },

  resultActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  resetBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: C.teal,
  },
  resetBtnText: { fontSize: 14, fontFamily: 'Sora_500Medium', color: C.teal },
  homeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, borderRadius: 14, backgroundColor: C.surface,
  },
  homeBtnText: { fontSize: 14, fontFamily: 'Sora_500Medium', color: C.textPrimary },
});
