import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Animated,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      // Use scrollTo instead of scrollToIndex for better web compatibility
      flatListRef.current?.scrollToOffset({ offset: nextIndex * SCREEN_WIDTH, animated: true });
    } else {
      router.replace('/google-oauth');
    }
  };

  const handleSkip = () => {
    const lastIndex = SLIDES.length - 1;
    setCurrentIndex(lastIndex);
    flatListRef.current?.scrollToOffset({ offset: lastIndex * SCREEN_WIDTH, animated: true });
  };

  const onScroll = (e: any) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index !== currentIndex && index >= 0 && index < SLIDES.length) {
      setCurrentIndex(index);
    }
  };

  // Bottom bar ~140px: dots + button + padding
  const slideHeight = SCREEN_HEIGHT - 140 - (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);

  const renderSlide = ({ item }: { item: typeof SLIDES[0] }) => (
    <View style={[styles.slide, { width: SCREEN_WIDTH, height: slideHeight, backgroundColor: item.bg }]}>
      <LinearGradient
        colors={['#7F00FF', '#C97EB8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.emojiCircle}
      >
        <Text style={styles.emoji}>{item.emoji}</Text>
      </LinearGradient>
      <Text style={styles.slideTitle}>{item.title}</Text>
      <Text style={styles.slideBody}>{item.body}</Text>
    </View>
  );

  return (
    <View style={styles.container} testID="onboarding-screen">
      <StatusBar barStyle="dark-content" />

      {/* Skip button */}
      <TouchableOpacity
        style={styles.skipBtn}
        onPress={handleSkip}
        testID="onboarding-skip-btn"
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { 
            useNativeDriver: false,
            listener: onScroll
          }
        )}
        scrollEventThrottle={16}
        testID="onboarding-flatlist"
      />

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        {/* Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => {
            const dotWidth = scrollX.interpolate({
              inputRange: [(i - 1) * SCREEN_WIDTH, i * SCREEN_WIDTH, (i + 1) * SCREEN_WIDTH],
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });
            const dotBg = scrollX.interpolate({
              inputRange: [(i - 1) * SCREEN_WIDTH, i * SCREEN_WIDTH, (i + 1) * SCREEN_WIDTH],
              outputRange: ['#E8D9E4', '#7F00FF', '#E8D9E4'],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  { width: dotWidth, backgroundColor: dotBg },
                ]}
                testID={`onboarding-dot-${i}`}
              />
            );
          })}
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
    backgroundColor: '#F7F0F5',
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
  slide: {
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
