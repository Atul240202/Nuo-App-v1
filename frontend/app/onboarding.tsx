import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    emoji: '\u26A1',
    title: 'Track your recovery',
    body: 'Smart insights tailored to your performance cycle',
    bg: '#E4D9F0',
  },
  {
    id: '2',
    emoji: '\uD83C\uDFAF',
    title: 'Stay on your goals',
    body: 'Daily streaks and micro-wins keep momentum alive',
    bg: '#F2DCEA',
  },
  {
    id: '3',
    emoji: '\uD83D\uDE80',
    title: 'Perform without limits',
    body: 'Optimized routines that fit your life, not the other way',
    bg: '#F7F0F5',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const dotWidths = SLIDES.map((_, i) =>
    useRef(new Animated.Value(i === 0 ? 24 : 8)).current
  );

  useEffect(() => {
    SLIDES.forEach((_, i) => {
      Animated.timing(dotWidths[i], {
        toValue: i === currentIndex ? 24 : 8,
        duration: 300,
        useNativeDriver: false,
      }).start();
    });
  }, [currentIndex]);

  const animateTransition = (nextIndex: number) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setCurrentIndex(nextIndex);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      animateTransition(currentIndex + 1);
    } else {
      router.replace('/google-oauth');
    }
  };

  const handleSkip = () => {
    animateTransition(SLIDES.length - 1);
  };

  const slide = SLIDES[currentIndex];

  return (
    <View
      style={[styles.container, { backgroundColor: slide.bg }]}
      testID="onboarding-screen"
    >
      <StatusBar barStyle="dark-content" />

      {/* Skip button */}
      <TouchableOpacity
        style={styles.skipBtn}
        onPress={handleSkip}
        testID="onboarding-skip-btn"
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Slide Content */}
      <Animated.View
        style={[styles.slideContent, { opacity: fadeAnim }]}
        testID={`onboarding-slide-${slide.id}`}
      >
        <LinearGradient
          colors={['#7F00FF', '#C97EB8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.emojiCircle}
        >
          <Text style={styles.emoji}>{slide.emoji}</Text>
        </LinearGradient>
        <Text style={styles.slideTitle}>{slide.title}</Text>
        <Text style={styles.slideBody}>{slide.body}</Text>
      </Animated.View>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        {/* Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  width: dotWidths[i],
                  backgroundColor: i === currentIndex ? '#7F00FF' : '#E8D9E4',
                },
              ]}
              testID={`onboarding-dot-${i}`}
            />
          ))}
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          onPress={handleNext}
          activeOpacity={0.9}
          testID="onboarding-cta-btn"
        >
          <LinearGradient
            colors={['#7F00FF', '#6B00CC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaButton}
          >
            <Text style={styles.ctaText}>
              {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  skipBtn: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 16 : 56,
    right: 24,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#7A7085',
  },
  slideContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emojiCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 36,
  },
  slideTitle: {
    fontSize: 28,
    fontFamily: 'Poppins_700Bold',
    color: '#2A1F3D',
    textAlign: 'center',
    marginTop: 28,
  },
  slideBody: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#7A7085',
    textAlign: 'center',
    maxWidth: 280,
    marginTop: 12,
    lineHeight: 24,
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 48 : 32,
    backgroundColor: 'transparent',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  ctaButton: {
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
});
