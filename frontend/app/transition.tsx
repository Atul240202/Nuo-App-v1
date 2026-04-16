import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { LIGHT } from '../constants/theme';

export default function TransitionScreen() {
  const router = useRouter();
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    const timer = setTimeout(() => router.replace('/voice'), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container} testID="transition-screen">
      <StatusBar barStyle="dark-content" />
      <Animated.View style={{ opacity: fadeIn, alignItems: 'center' }}>
        <Text style={styles.headline}>You're all set</Text>
        <Text style={styles.sub}>Now let's understand what you're feeling</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LIGHT.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  headline: { fontSize: 28, fontFamily: 'Poppins_700Bold', color: LIGHT.text, marginBottom: 12 },
  sub: { fontSize: 16, fontFamily: 'Inter_400Regular', color: LIGHT.textMuted, textAlign: 'center' },
});
