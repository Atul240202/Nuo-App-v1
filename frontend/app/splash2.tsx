import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING_SIZE = 140;
const STROKE_WIDTH = 4;
const RADIUS = 60;
const CX = 70;
const CY = 70;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function SplashScreen2() {
  const router = useRouter();

  const ringAnim = useRef(new Animated.Value(CIRCUMFERENCE)).current;
  const glowOpacity = useRef(new Animated.Value(0.5)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(20)).current;
  const subOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Ring stroke animation: starts at 400ms, 1200ms duration
    Animated.sequence([
      Animated.delay(400),
      Animated.timing(ringAnim, {
        toValue: 0,
        duration: 1200,
        useNativeDriver: false,
      }),
    ]).start();

    // Ring glow: loop opacity 0.5→1→0.5 every 2000ms
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    // "Without stopping": opacity + translateY at 900ms
    Animated.sequence([
      Animated.delay(900),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(textTranslateY, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();

    // Subtitle at 1300ms
    Animated.sequence([
      Animated.delay(1300),
      Animated.timing(subOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    // Auto-navigate after 3800ms
    const timer = setTimeout(() => {
      router.replace('/onboarding');
    }, 3800);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container} testID="splash2-screen">
      <StatusBar barStyle="dark-content" />

      {/* Animated SVG Ring */}
      <Animated.View style={[styles.ringWrapper, { opacity: glowOpacity }]} testID="splash2-ring">
        <Svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        >
          {/* Background circle */}
          <Circle
            cx={CX}
            cy={CY}
            r={RADIUS}
            stroke="#E4D9F0"
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          {/* Animated progress circle */}
          <AnimatedCircle
            cx={CX}
            cy={CY}
            r={RADIUS}
            stroke="#7F00FF"
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE}`}
            strokeDashoffset={ringAnim}
            strokeLinecap="round"
            rotation="-90"
            origin={`${CX}, ${CY}`}
          />
        </Svg>
      </Animated.View>

      {/* Title */}
      <Animated.View
        style={{
          opacity: textOpacity,
          transform: [{ translateY: textTranslateY }],
        }}
      >
        <Text style={styles.title}>Without stopping</Text>
      </Animated.View>

      {/* Subtitle */}
      <Animated.View style={{ opacity: subOpacity }}>
        <Text style={styles.subtitle}>
          We handle the recovery while you keep going
        </Text>
      </Animated.View>

      {/* Skip button */}
      <TouchableOpacity
        style={styles.skipBtn}
        onPress={() => router.replace('/onboarding')}
        testID="splash2-skip-btn"
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F0F5',
    paddingHorizontal: 32,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  ringWrapper: {
    marginBottom: 40,
    shadowColor: '#7F00FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 4,
  },
  title: {
    fontSize: 34,
    fontFamily: 'Poppins_700Bold',
    color: '#2A1F3D',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#7A7085',
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 24,
  },
  skipBtn: {
    position: 'absolute',
    bottom: 48,
    right: 32,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#7A7085',
  },
});
