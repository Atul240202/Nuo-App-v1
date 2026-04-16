import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { LIGHT } from '../constants/theme';
import Svg, { Path } from 'react-native-svg';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

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
  const [loading, setLoading] = useState(false);

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      // MOCKED: Create mock user session on backend
      const resp = await fetch(`${BACKEND_URL}/api/auth/mock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (resp.ok) {
        router.replace('/intro');
        return;
      }
    } catch {}
    // Fallback: just navigate
    setTimeout(() => router.replace('/intro'), 500);
  };

  return (
    <View style={styles.container} testID="auth-screen">
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        <View style={styles.logoMark}>
          <Text style={styles.logoMarkText}>N</Text>
        </View>

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
  logoMark: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: LIGHT.text,
    alignItems: 'center', justifyContent: 'center', marginBottom: 32,
  },
  logoMarkText: { fontSize: 28, fontFamily: 'Poppins_700Bold', color: LIGHT.bg },
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
