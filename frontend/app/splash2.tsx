import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, ImageBackground, TouchableOpacity, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { GRADIENT_BG_BASE64, DARK } from '../constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const R = 60, CX = 70, CY = 70, CIRC = 2 * Math.PI * R;

export default function Splash2Screen() {
  const router = useRouter();
  const breatheAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(CIRC)).current;
  const glowOpacity = useRef(new Animated.Value(0.4)).current;
  const headOpacity = useRef(new Animated.Value(0)).current;
  const headY = useRef(new Animated.Value(20)).current;
  const subOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(breatheAnim, { toValue: 1.04, duration: 3500, useNativeDriver: true }),
      Animated.timing(breatheAnim, { toValue: 1, duration: 3500, useNativeDriver: true }),
    ])).start();

    Animated.loop(Animated.sequence([
      Animated.timing(glowOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.timing(glowOpacity, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
    ])).start();

    Animated.sequence([
      Animated.delay(400),
      Animated.timing(ringAnim, { toValue: 0, duration: 1200, useNativeDriver: false }),
    ]).start();

    Animated.sequence([
      Animated.delay(900),
      Animated.parallel([
        Animated.timing(headOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(headY, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(1300),
      Animated.timing(subOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => router.replace('/auth'), 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container} testID="splash2-screen">
      <StatusBar barStyle="light-content" />
      <Animated.View style={[styles.bgWrapper, { transform: [{ scale: breatheAnim }] }]}>
        <ImageBackground source={{ uri: GRADIENT_BG_BASE64 }} style={styles.bgImage} resizeMode="cover" />
      </Animated.View>
      <View style={styles.overlay} />

      <Animated.View style={[styles.ringWrapper, { opacity: glowOpacity }]}>
        <Svg width={140} height={140} viewBox="0 0 140 140">
          <Circle cx={CX} cy={CY} r={R} stroke="rgba(157,108,255,0.15)" strokeWidth={4} fill="none" />
          <AnimatedCircle cx={CX} cy={CY} r={R} stroke={DARK.accent} strokeWidth={4} fill="none"
            strokeDasharray={`${CIRC}`} strokeDashoffset={ringAnim} strokeLinecap="round" rotation="-90" origin={`${CX},${CY}`} />
        </Svg>
      </Animated.View>

      <Animated.View style={{ opacity: headOpacity, transform: [{ translateY: headY }] }}>
        <Text style={styles.headline}>Without stopping</Text>
      </Animated.View>
      <Animated.View style={{ opacity: subOpacity }}>
        <Text style={styles.sub}>We handle the recovery while you keep going</Text>
      </Animated.View>

      <TouchableOpacity style={styles.skipBtn} onPress={() => router.replace('/auth')} testID="splash2-skip-btn">
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
  ringWrapper: { marginBottom: 40 },
  headline: { fontSize: 34, fontFamily: 'Poppins_700Bold', color: DARK.text, textAlign: 'center', marginBottom: 12 },
  sub: { fontSize: 16, fontFamily: 'Inter_400Regular', color: DARK.textMuted, textAlign: 'center', maxWidth: 260, lineHeight: 24 },
  skipBtn: { position: 'absolute', bottom: 48, right: 32, paddingHorizontal: 16, paddingVertical: 14, minWidth: 44, minHeight: 44 },
  skipText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: DARK.textDim },
});
