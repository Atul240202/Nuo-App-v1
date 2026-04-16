import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, StatusBar, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { LIGHT } from '../constants/theme';
import { NUO_LOGO } from '../constants/nuoLogo';

export default function TransitionScreen() {
  const router = useRouter();
  const fadeIn = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 800, useNativeDriver: true }).start();

    // Spinning logo
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 3000, useNativeDriver: true })
    ).start();

    // 3-dot progress indicator
    const dotLoop = (dot: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
      ]));
    dotLoop(dot1, 0).start();
    dotLoop(dot2, 300).start();
    dotLoop(dot3, 600).start();

    const timer = setTimeout(() => router.replace('/voice'), 3000);
    return () => clearTimeout(timer);
  }, []);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.container} testID="transition-screen">
      <StatusBar barStyle="dark-content" />
      <Animated.View style={{ opacity: fadeIn, alignItems: 'center' }}>
        <Animated.View style={[styles.logoWrap, { transform: [{ rotate: spin }] }]}>
          <Image source={{ uri: NUO_LOGO }} style={styles.logoImg} />
        </Animated.View>
        <Text style={styles.headline}>You're all set</Text>
        <Text style={styles.sub}>Now let's understand what you're feeling</Text>
        <View style={styles.dotsRow}>
          {[dot1, dot2, dot3].map((d, i) => (
            <Animated.View key={i} style={[styles.dot, { opacity: d }]} />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LIGHT.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  logoWrap: { marginBottom: 32 },
  logoImg: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#0A0A14' },
  headline: { fontSize: 28, fontFamily: 'Poppins_700Bold', color: LIGHT.text, marginBottom: 12 },
  sub: { fontSize: 16, fontFamily: 'Inter_400Regular', color: LIGHT.textMuted, textAlign: 'center', marginBottom: 24 },
  dotsRow: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7F00FF' },
});
