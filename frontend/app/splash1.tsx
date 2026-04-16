import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, ImageBackground, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { GRADIENT_BG_BASE64, DARK } from '../constants/theme';

export default function Splash1Screen() {
  const router = useRouter();
  const breatheAnim = useRef(new Animated.Value(1)).current;
  const headlineOpacity = useRef(new Animated.Value(0)).current;
  const subOpacity = useRef(new Animated.Value(0)).current;
  const optionalOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1.03, duration: 4000, useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
      ])
    ).start();

    Animated.sequence([
      Animated.delay(300),
      Animated.timing(headlineOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(900),
      Animated.timing(subOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(1500),
      Animated.timing(optionalOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => router.replace('/splash2'), 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container} testID="splash1-screen">
      <StatusBar barStyle="light-content" />
      <Animated.View style={[styles.bgWrapper, { transform: [{ scale: breatheAnim }] }]}>
        <ImageBackground source={{ uri: GRADIENT_BG_BASE64 }} style={styles.bgImage} resizeMode="cover" />
      </Animated.View>
      <View style={styles.overlay} />

      <Animated.View style={{ opacity: headlineOpacity }}>
        <Text style={styles.headline}>Built for high performers</Text>
      </Animated.View>
      <Animated.View style={{ opacity: subOpacity }}>
        <Text style={styles.sub}>who need to recover fast</Text>
      </Animated.View>
      <Animated.View style={{ opacity: optionalOpacity }}>
        <Text style={styles.optional}>Because slowing down isn't always an option</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A14' },
  bgWrapper: { ...StyleSheet.absoluteFillObject },
  bgImage: { flex: 1, opacity: 0.7 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,20,0.3)' },
  headline: { fontSize: 34, fontFamily: 'Poppins_700Bold', color: DARK.text, textAlign: 'center', paddingHorizontal: 32 },
  sub: { fontSize: 26, fontFamily: 'Poppins_600SemiBold', color: DARK.accent, textAlign: 'center', marginTop: 8, paddingHorizontal: 32 },
  optional: { fontSize: 14, fontFamily: 'Inter_400Regular', fontStyle: 'italic', color: DARK.textDim, textAlign: 'center', marginTop: 16, paddingHorizontal: 40 },
});
