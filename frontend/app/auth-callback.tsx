import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LIGHT } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch, setSessionToken } from '../utils/api';

export default function AuthCallback() {
  const router = useRouter();
  const { refresh } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      try {
        let sessionId = '';

        if (Platform.OS === 'web') {
          // Emergent Auth returns session_id in URL fragment: #session_id=xxx
          const hash = window.location.hash || '';
          const clean = hash.startsWith('#') ? hash.substring(1) : hash;
          const params = new URLSearchParams(clean);
          sessionId = params.get('session_id') || '';

          // Also check query string as fallback
          if (!sessionId) {
            const search = new URLSearchParams(window.location.search);
            sessionId = search.get('session_id') || '';
          }
        }

        if (!sessionId) {
          router.replace('/auth');
          return;
        }

        // Exchange session_id for session_token with backend
        const resp = await apiFetch('/api/auth/session', {
          method: 'POST',
          jsonBody: { session_id: sessionId },
        });

        if (!resp.ok) {
          router.replace('/auth');
          return;
        }

        const data = await resp.json();
        if (data.session_token) {
          await setSessionToken(data.session_token);
        }

        // Reload user in AuthContext
        const user = await refresh();

        // Decide next route
        if (user && user.personalization) {
          router.replace('/home');
        } else {
          router.replace('/intro');
        }
      } catch {
        router.replace('/auth');
      }
    };

    processAuth();
  }, []);

  return (
    <View style={styles.container} testID="auth-callback-screen">
      <ActivityIndicator size="large" color={LIGHT.accent} />
      <Text style={styles.text}>Signing you in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LIGHT.bg, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 16, fontFamily: 'Inter_500Medium', color: LIGHT.textMuted, marginTop: 16 },
});
