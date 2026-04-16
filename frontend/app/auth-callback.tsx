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
        let accessToken = '';

        if (Platform.OS === 'web') {
          // Google OAuth implicit flow returns access_token in URL hash
          const hash = window.location.hash;
          const tokenMatch = hash.match(/access_token=([^&]+)/);
          if (tokenMatch) {
            accessToken = tokenMatch[1];
          }
        }

        if (!accessToken) {
          router.replace('/auth');
          return;
        }

        // Send Google access token to backend
        const resp = await fetch(`${BACKEND_URL}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ access_token: accessToken }),
        });

        if (!resp.ok) {
          router.replace('/auth');
          return;
        }

        const data = await resp.json();
        // Store session token for mobile
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          if (data.session_token) await AsyncStorage.setItem('session_token', data.session_token);
        } catch {}

        // Navigate to intro (skip splashes)
        router.replace('/intro');
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
