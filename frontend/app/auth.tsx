import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, StatusBar, Image, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LIGHT } from '../constants/theme';
import { NUO_LOGO } from '../constants/nuoLogo';
import Svg, { Path } from 'react-native-svg';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { useAuth } from '../contexts/AuthContext';
import { setSessionToken, BACKEND_URL, apiFetch } from '../utils/api';

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const EMERGENT_AUTH_BASE = 'https://auth.emergentagent.com/';

function GoogleGIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 48 48">
      <Path d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" fill="#EA4335" />
      <Path d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v8.5h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" fill="#4285F4" />
      <Path d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" fill="#FBBC05" />
      <Path d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" fill="#34A853" />
    </Svg>
  );
}

export default function AuthScreen() {
  const router = useRouter();
  const { user, loading: authLoading, refresh } = useAuth();
  const [loading, setLoading] = useState(false);

  // If already authenticated, skip straight to home
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/home');
    }
  }, [authLoading, user, router]);

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      if (Platform.OS === 'web') {
        // WEB: redirect to Emergent Auth with current origin as redirect
        // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
        const redirectUrl = window.location.origin + '/auth-callback';
        window.location.href = `${EMERGENT_AUTH_BASE}?redirect=${encodeURIComponent(redirectUrl)}`;
        return;
      }

      // NATIVE: Use in-app browser and listen for our web-preview callback URL
      // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
      const redirectUrl = makeRedirectUri({ path: 'auth-callback' });
      const authUrl = `${EMERGENT_AUTH_BASE}?redirect=${encodeURIComponent(redirectUrl)}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

      if (result.type === 'success' && result.url) {
        // Parse session_id from URL fragment
        const url = result.url;
        const hashIdx = url.indexOf('#');
        const fragment = hashIdx >= 0 ? url.substring(hashIdx + 1) : '';
        const params = new URLSearchParams(fragment);
        const sessionId = params.get('session_id');
        if (!sessionId) {
          Alert.alert('Sign-in failed', 'Could not retrieve session.');
          setLoading(false);
          return;
        }
        // Exchange with backend
        const resp = await apiFetch('/api/auth/session', {
          method: 'POST',
          jsonBody: { session_id: sessionId },
        });
        if (!resp.ok) {
          Alert.alert('Sign-in failed', 'Session exchange failed.');
          setLoading(false);
          return;
        }
        const data = await resp.json();
        if (data.session_token) await setSessionToken(data.session_token);
        const fresh = await refresh();
        // If new user (no personalization), go to intro, else home
        if (fresh && !fresh.personalization) {
          router.replace('/intro');
        } else {
          router.replace('/home');
        }
      } else {
        setLoading(false);
      }
    } catch (err) {
      setLoading(false);
      Alert.alert('Sign-in error', 'Please try again.');
    }
  };

  if (authLoading) {
    return (
      <View style={[styles.container, { alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={LIGHT.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="auth-screen">
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        <Image source={{ uri: NUO_LOGO }} style={styles.logoImg} />

        <Text style={styles.headline}>Continue to Nuo</Text>
        <Text style={styles.sub}>Securely connect to personalize your recovery</Text>

        <TouchableOpacity
          style={[styles.googleBtn, loading && styles.googleBtnDisabled]}
          onPress={handleGoogleAuth}
          disabled={loading}
          activeOpacity={0.8}
          testID="google-auth-btn"
        >
          {loading ? (
            <ActivityIndicator size="small" color={LIGHT.accent} />
          ) : (
            <View style={styles.btnRow}>
              <GoogleGIcon />
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.micro}>We only use this to personalize your experience</Text>
        <Text style={styles.footer}>Your data stays private</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LIGHT.bg, justifyContent: 'center' },
  content: { alignItems: 'center', paddingHorizontal: 32 },
  logoImg: { width: 80, height: 80, marginBottom: 32, borderRadius: 40, backgroundColor: '#0A0A14' },
  headline: { fontSize: 26, fontFamily: 'Poppins_700Bold', color: LIGHT.text, marginBottom: 8 },
  sub: { fontSize: 15, fontFamily: 'Inter_400Regular', color: LIGHT.textMuted, textAlign: 'center', marginBottom: 40 },
  googleBtn: {
    width: '100%', height: 56, backgroundColor: LIGHT.bg, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    borderWidth: 1, borderColor: LIGHT.border, marginBottom: 16,
  },
  googleBtnDisabled: { opacity: 0.6 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  googleBtnText: { fontSize: 16, fontFamily: 'Inter_500Medium', color: LIGHT.text },
  micro: { fontSize: 13, fontFamily: 'Inter_400Regular', color: LIGHT.textDim, textAlign: 'center', marginBottom: 8 },
  footer: { fontSize: 13, fontFamily: 'Inter_400Regular', color: LIGHT.textMuted, textAlign: 'center' },
});
