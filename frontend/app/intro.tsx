import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, TouchableOpacity, StatusBar, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { LIGHT } from '../constants/theme';
import { NUO_LOGO } from '../constants/nuoLogo';

export default function IntroScreen() {
  const router = useRouter();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.6)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.15, duration: 2000, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
    ])).start();

    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.6, duration: 1500, useNativeDriver: true }),
    ])).start();

    Animated.timing(fadeIn, { toValue: 1, duration: 800, delay: 300, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={styles.container} testID="intro-screen">
      <StatusBar barStyle="dark-content" />

      {/* Pulsating logo */}
      <Animated.View style={[styles.logoWrap, { transform: [{ scale: pulseAnim }], opacity: glowAnim }]}>
        <Image source={{ uri: NUO_LOGO }} style={styles.logoImg} />
      </Animated.View>

      <Animated.View style={[styles.textWrap, { opacity: fadeIn }]}>
        <Text style={styles.headline}>Meet Nuo</Text>
        <Text style={styles.sub}>Your intelligent companion for recovery</Text>
        <Text style={styles.hook}>It understands your state—and responds before you have to</Text>
      </Animated.View>

      <TouchableOpacity
        style={styles.ctaBtn}
        onPress={() => router.replace('/personalization')}
        activeOpacity={0.9}
        testID="intro-get-started-btn"
      >
        <LinearGradient colors={['#7F00FF', '#5A00B8']} style={styles.ctaGradient}>
          <Text style={styles.ctaText}>Get Started</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LIGHT.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  logoWrap: { marginBottom: 40 },
  logoImg: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#0A0A14' },
  textWrap: { alignItems: 'center', marginBottom: 48 },
  headline: { fontSize: 28, fontFamily: 'Poppins_700Bold', color: LIGHT.text, marginBottom: 8 },
  sub: { fontSize: 16, fontFamily: 'Inter_400Regular', color: LIGHT.textMuted, textAlign: 'center', marginBottom: 12 },
  hook: { fontSize: 14, fontFamily: 'Inter_400Regular', fontStyle: 'italic', color: LIGHT.textDim, textAlign: 'center', maxWidth: 280 },
  ctaBtn: { width: '100%' },
  ctaGradient: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF' },
});
