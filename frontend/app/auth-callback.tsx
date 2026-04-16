import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LIGHT } from '../constants/theme';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function AuthCallback() {
  const router = useRouter();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      try {
        let sessionId = '';
        if (Platform.OS === 'web') {
          const hash = window.location.hash;
          const match = hash.match(/session_id=([^&]+)/);
          if (match) sessionId = match[1];
        }

        if (!sessionId) {
          router.replace('/auth');
          return;
        }

        const resp = await fetch(`${BACKEND_URL}/api/auth/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ session_id: sessionId }),
        });

        if (!resp.ok) {
          router.replace('/auth');
          return;
        }

        router.replace('/intro');
      } catch {
        router.replace('/auth');
      }
    };

    processAuth();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={LIGHT.accent} />
      <Text style={styles.text}>Signing you in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LIGHT.bg, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 16, fontFamily: 'Inter_500Medium', color: LIGHT.textMuted, marginTop: 16 },
});
