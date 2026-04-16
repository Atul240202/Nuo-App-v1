import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

function GoogleGIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 48 48">
      <Path
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        fill="#EA4335"
      />
      <Path
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v8.5h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        fill="#4285F4"
      />
      <Path
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        fill="#FBBC05"
      />
      <Path
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        fill="#34A853"
      />
    </Svg>
  );
}

function WaveLogo() {
  return (
    <LinearGradient
      colors={['#7F00FF', '#C97EB8']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.logoCircle}
    >
      <Svg width={28} height={28} viewBox="0 0 72 72" fill="none">
        <Path
          d="M 16 40 Q 28 24 36 36 Q 44 48 56 32"
          stroke="#FFFFFF"
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </LinearGradient>
  );
}

export default function GoogleOAuthScreen() {
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const handleGoogleSignIn = () => {
    setGoogleLoading(true);
    setTimeout(() => {
      router.replace('/home');
    }, 1500);
  };

  const handleAppleSignIn = () => {
    setAppleLoading(true);
    setTimeout(() => {
      router.replace('/home');
    }, 1500);
  };

  return (
    <View style={styles.container} testID="google-oauth-screen">
      <StatusBar barStyle="dark-content" />

      <View style={styles.content}>
        {/* Logo */}
        <WaveLogo />

        {/* Title */}
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to continue your journey</Text>

        {/* Google Button */}
        <TouchableOpacity
          style={styles.googleBtn}
          onPress={handleGoogleSignIn}
          disabled={googleLoading || appleLoading}
          activeOpacity={0.8}
          testID="google-signin-btn"
        >
          {googleLoading ? (
            <ActivityIndicator size="small" color="#7F00FF" />
          ) : (
            <View style={styles.btnRow}>
              <GoogleGIcon />
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Apple Button */}
        <TouchableOpacity
          style={styles.appleBtn}
          onPress={handleAppleSignIn}
          disabled={googleLoading || appleLoading}
          activeOpacity={0.8}
          testID="apple-signin-btn"
        >
          {appleLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <View style={styles.btnRow}>
              <Ionicons name="logo-apple" size={22} color="#FFFFFF" />
              <Text style={styles.appleBtnText}>Continue with Apple</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By continuing you agree to our{' '}
          </Text>
          <View style={styles.footerLinks}>
            <TouchableOpacity
              onPress={() => Alert.alert('Coming soon')}
              testID="terms-link"
            >
              <Text style={styles.footerLink}>Terms</Text>
            </TouchableOpacity>
            <Text style={styles.footerText}> & </Text>
            <TouchableOpacity
              onPress={() => Alert.alert('Coming soon')}
              testID="privacy-link"
            >
              <Text style={styles.footerLink}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F0F5',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontFamily: 'Poppins_700Bold',
    color: '#2A1F3D',
    marginTop: 24,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#7A7085',
    marginTop: 8,
    marginBottom: 40,
  },
  googleBtn: {
    width: '100%',
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8D9E4',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  googleBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: '#2A1F3D',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E8D9E4',
  },
  dividerText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#7A7085',
    paddingHorizontal: 12,
  },
  appleBtn: {
    width: '100%',
    height: 56,
    backgroundColor: '#2A1F3D',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: '#FFFFFF',
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#7A7085',
  },
  footerLink: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#7F00FF',
  },
});
