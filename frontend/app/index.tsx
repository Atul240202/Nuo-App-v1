import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, ImageBackground, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { GRADIENT_BG_BASE64, DARK } from '../constants/theme';

export default function LogoScreen() {
  const router = useRouter();
  const breatheAnim = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const microOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Breathing pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1.05, duration: 3000, useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
      ])
    ).start();

    // Logo fade in
    Animated.sequence([
      Animated.delay(500),
      Animated.timing(logoOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
    ]).start();

    // Tagline
    Animated.sequence([
      Animated.delay(1500),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
    ]).start();

    // Micro text
    Animated.sequence([
      Animated.delay(2200),
      Animated.timing(microOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => router.replace('/splash1'), 4500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Animated.View style={[styles.bgWrapper, { transform: [{ scale: breatheAnim }] }]}>
        <ImageBackground
          source={{ uri: GRADIENT_BG_BASE64 }}
          style={styles.bgImage}
          resizeMode="cover"
        />
      </Animated.View>
      <View style={styles.overlay} />

      <Animated.View style={[styles.content, { opacity: logoOpacity }]}>
        <ImageBackground
          source={require('../assets/images/nuo-logo.png')}
          style={styles.logo}
          resizeMode="contain"
          testID="nuo-logo"
        />
      </Animated.View>

      <Animated.View style={{ opacity: logoOpacity }}>
        <Text style={styles.logoText}>Nuo</Text>
      </Animated.View>

      <Animated.View style={{ opacity: taglineOpacity }}>
        <Text style={styles.tagline}>Automatic Nervous Regulation Layer</Text>
      </Animated.View>

      <Animated.View style={{ opacity: microOpacity }}>
        <Text style={styles.microtext}>Works even when you do nothing</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0A14',
  },
  bgWrapper: {
    ...StyleSheet.absoluteFillObject,
  },
  bgImage: {
    flex: 1,
    opacity: 0.7,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,20,0.3)',
  },
  content: {
    marginBottom: 16,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 16,
    overflow: 'hidden',
  },
  logoText: {
    fontSize: 48,
    fontFamily: 'Poppins_700Bold',
    color: DARK.text,
    letterSpacing: 4,
    marginBottom: 12,
  },
  tagline: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: DARK.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 24,
  },
  microtext: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
    color: DARK.textDim,
    textAlign: 'center',
  },
});
