import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

export default function SplashScreen1() {
  const router = useRouter();

  const bgAnim = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const line1Opacity = useRef(new Animated.Value(0)).current;
  const line2Opacity = useRef(new Animated.Value(0)).current;
  const line3Opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Background color (non-native driver)
    Animated.timing(bgAnim, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: false,
    }).start();

    // Logo: opacity + scale at 300ms delay
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    ]).start();

    // Line 1 at 900ms
    Animated.sequence([
      Animated.delay(900),
      Animated.timing(line1Opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    // Line 2 at 1300ms
    Animated.sequence([
      Animated.delay(1300),
      Animated.timing(line2Opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    // Line 3 at 1700ms
    Animated.sequence([
      Animated.delay(1700),
      Animated.timing(line3Opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    // Auto-navigate after 3500ms
    const timer = setTimeout(() => {
      router.replace('/splash2');
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  const backgroundColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#EDE0EA', '#F7F0F5'],
  });

  return (
    <Animated.View style={[styles.container, { backgroundColor }]} testID="splash1-screen">
      <StatusBar barStyle="dark-content" />

      {/* Logo */}
      <Animated.View
        style={[
          styles.logoWrapper,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
        testID="splash1-logo"
      >
        <LinearGradient
          colors={['#7F00FF', '#C97EB8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logoCircle}
        >
          <Svg width={36} height={36} viewBox="0 0 72 72" fill="none">
            <Path
              d="M 16 40 Q 28 24 36 36 Q 44 48 56 32"
              stroke="#FFFFFF"
              strokeWidth={4}
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
        </LinearGradient>
      </Animated.View>

      {/* Line 1 */}
      <Animated.View style={[styles.textBlock, { opacity: line1Opacity }]}>
        <Text style={styles.line1}>Built for high performers</Text>
      </Animated.View>

      {/* Line 2 */}
      <Animated.View style={[styles.textBlock, { opacity: line2Opacity }]}>
        <Text style={styles.line2}>who need to recover fast</Text>
      </Animated.View>

      {/* Line 3 */}
      <Animated.View style={[styles.textBlock, { opacity: line3Opacity }]}>
        <Text style={styles.line3}>Because slowing down isn't always an option</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  logoWrapper: {
    marginBottom: 40,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    alignItems: 'center',
  },
  line1: {
    fontSize: 32,
    fontFamily: 'Poppins_700Bold',
    color: '#2A1F3D',
    textAlign: 'center',
    lineHeight: 40,
  },
  line2: {
    fontSize: 28,
    fontFamily: 'Poppins_600SemiBold',
    color: '#7F00FF',
    textAlign: 'center',
    lineHeight: 36,
    marginTop: 4,
  },
  line3: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
    color: '#7A7085',
    textAlign: 'center',
    marginTop: 12,
  },
});
