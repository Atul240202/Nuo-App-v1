import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Animated, StyleSheet, TouchableOpacity, ImageBackground, StatusBar, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENT_BG_BASE64, DARK } from '../constants/theme';

type VoiceState = 'idle' | 'listening' | 'processing';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function VoiceScreen() {
  const router = useRouter();
  const [state, setState] = useState<VoiceState>('idle');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  const breatheAnim = useRef(new Animated.Value(1)).current;
  const orbScale = useRef(new Animated.Value(1)).current;
  const orbGlow = useRef(new Animated.Value(0.6)).current;
  const textFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Request mic permission
    (async () => {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        setHasPermission(status === 'granted');
      } catch {
        setHasPermission(false);
      }
    })();

    // Background breathing
    Animated.loop(Animated.sequence([
      Animated.timing(breatheAnim, { toValue: 1.04, duration: 3500, useNativeDriver: true }),
      Animated.timing(breatheAnim, { toValue: 1, duration: 3500, useNativeDriver: true }),
    ])).start();

    // Orb idle pulse
    Animated.loop(Animated.sequence([
      Animated.timing(orbScale, { toValue: 1.1, duration: 2500, useNativeDriver: true }),
      Animated.timing(orbScale, { toValue: 1, duration: 2500, useNativeDriver: true }),
    ])).start();

    Animated.loop(Animated.sequence([
      Animated.timing(orbGlow, { toValue: 1, duration: 1500, useNativeDriver: true }),
      Animated.timing(orbGlow, { toValue: 0.6, duration: 1500, useNativeDriver: true }),
    ])).start();

    Animated.timing(textFade, { toValue: 1, duration: 800, delay: 500, useNativeDriver: true }).start();
  }, []);

  const startRecording = async () => {
    if (!hasPermission) return;
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      setState('listening');

      // Expand orb for listening
      Animated.spring(orbScale, { toValue: 1.3, useNativeDriver: true }).start();
    } catch {
      setState('idle');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setState('processing');
    Animated.spring(orbScale, { toValue: 1, useNativeDriver: true }).start();

    try {
      await recording.stopAndUnloadAsync();
      const status = await recording.getStatusAsync();
      const duration = status.durationMillis || 0;

      // Send to backend
      try {
        await fetch(`${BACKEND_URL}/api/voice/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ duration }),
        });
      } catch {}

      setRecording(null);
      setTimeout(() => {
        setState('idle');
        router.replace('/home');
      }, 2000);
    } catch {
      setRecording(null);
      setState('idle');
    }
  };

  const handleOrbPress = () => {
    if (state === 'idle') startRecording();
    else if (state === 'listening') stopRecording();
  };

  const stateText = () => {
    if (state === 'idle') return "I'm listening when you're ready";
    if (state === 'listening') return "You're safe here.\nTell me what's going on in your mind.";
    return 'Understanding you...';
  };

  return (
    <View style={styles.container} testID="voice-screen">
      <StatusBar barStyle="light-content" />
      <Animated.View style={[styles.bgWrapper, { transform: [{ scale: breatheAnim }] }]}>
        <ImageBackground source={{ uri: GRADIENT_BG_BASE64 }} style={styles.bgImage} resizeMode="cover" />
      </Animated.View>
      <View style={styles.overlay} />

      {/* Orb */}
      <TouchableOpacity onPress={handleOrbPress} activeOpacity={0.9} testID="voice-orb-btn">
        <Animated.View style={[styles.orbOuter, { transform: [{ scale: orbScale }], opacity: orbGlow }]}>
          <LinearGradient colors={['#1A1523', '#2D1F4E', '#1A1523']} style={styles.orbInner}>
            <View style={[styles.orbCore, state === 'listening' && styles.orbCoreActive]} />
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>

      <Animated.View style={[styles.textWrap, { opacity: textFade }]}>
        <Text style={styles.stateText}>{stateText()}</Text>
        {state === 'idle' && (
          <Text style={styles.optional}>You don't have to structure it. Just speak.</Text>
        )}
      </Animated.View>

      {/* Skip to home */}
      <TouchableOpacity style={styles.skipBtn} onPress={() => router.replace('/home')} testID="voice-skip-btn">
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A14' },
  bgWrapper: { ...StyleSheet.absoluteFillObject },
  bgImage: { flex: 1, opacity: 0.7 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,20,0.3)' },
  orbOuter: {
    width: 140, height: 140, borderRadius: 70, marginBottom: 48,
    shadowColor: '#9D6CFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 50, elevation: 12,
  },
  orbInner: { width: 140, height: 140, borderRadius: 70, alignItems: 'center', justifyContent: 'center' },
  orbCore: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(157,108,255,0.25)' },
  orbCoreActive: { backgroundColor: 'rgba(157,108,255,0.6)', width: 50, height: 50, borderRadius: 25 },
  textWrap: { alignItems: 'center', paddingHorizontal: 40 },
  stateText: { fontSize: 18, fontFamily: 'Inter_500Medium', color: DARK.text, textAlign: 'center', lineHeight: 26 },
  optional: { fontSize: 13, fontFamily: 'Inter_400Regular', fontStyle: 'italic', color: DARK.textDim, marginTop: 12, textAlign: 'center' },
  skipBtn: { position: 'absolute', bottom: 48, right: 32, paddingHorizontal: 16, paddingVertical: 14, minWidth: 44, minHeight: 44 },
  skipText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: DARK.textDim },
});
