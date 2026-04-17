import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform,
  StatusBar, Animated, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Audio cache for instant replay
const audioCache = new Map<string, Audio.Sound>();

const COLORS = {
  background: '#F7F0F5',
  primary: '#7F00FF',
  primaryMuted: '#F0E5FF',
  cardBg: '#FFFFFF',
  textHeading: '#1A1523',
  textBody: '#6E6A7C',
  textInverse: '#FFFFFF',
  tabBarBg: '#FFFFFF',
  border: '#EDE5F5',
  iconBg: '#F0E5FF',
  teal: '#00d4aa',
  violet: '#8b5cf6',
  surfaceDark: 'rgba(127,0,255,0.06)',
};

interface AudioTrack {
  audio_id: string;
  title: string;
  label: string;
  desc?: string;
  duration: string;
  duration_sec: number;
  file_url: string;
}

export default function AudioLibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  const fetchTracks = useCallback(async () => {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/audio/library`);
      if (resp.ok) {
        const data = await resp.json();
        setTracks(data.tracks || []);
      }
    } catch (e) {
      console.log('Failed to fetch audio library', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTracks();
    return () => {
      // Cleanup: unload all cached sounds when component unmounts
      soundRef.current?.pauseAsync();
      audioCache.forEach((sound) => {
        sound.unloadAsync().catch(() => {});
      });
      audioCache.clear();
    };
  }, [fetchTracks]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTracks();
  }, [fetchTracks]);

  const onPlaybackStatusUpdate = useCallback((status: any) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis || 0);
      setDuration(status.durationMillis || 0);
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      }
    }
  }, []);

  const togglePlay = async (track: AudioTrack) => {
    // If tapping the same track that's already loaded
    if (activeTrackId === track.audio_id && soundRef.current) {
      if (isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
      return;
    }

    // Different track — pause previous but don't unload (keep in cache)
    if (soundRef.current) {
      await soundRef.current.pauseAsync();
    }

    setActiveTrackId(track.audio_id);
    setPosition(0);
    setDuration(0);
    setIsPlaying(false);

    if (!track.file_url) return;

    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      
      // Check if track is already cached
      const cachedSound = audioCache.get(track.audio_id);
      if (cachedSound) {
        // Reuse cached sound - instant playback!
        soundRef.current = cachedSound;
        cachedSound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
        // Set real-time progress updates (every 100ms)
        await cachedSound.setProgressUpdateIntervalAsync(100);
        await cachedSound.setPositionAsync(0);
        await cachedSound.playAsync();
        setIsPlaying(true);
        return;
      }

      // Not cached - create new sound with real-time progress updates
      const { sound } = await Audio.Sound.createAsync(
        { uri: track.file_url },
        { shouldPlay: true, progressUpdateIntervalMillis: 100 },
        onPlaybackStatusUpdate
      );
      soundRef.current = sound;
      audioCache.set(track.audio_id, sound); // Cache for instant replay
      setIsPlaying(true);
    } catch (e) {
      console.log('Audio playback error', e);
    }
  };

  const seekTo = async (ratio: number) => {
    if (soundRef.current && duration > 0) {
      const pos = Math.floor(ratio * duration);
      await soundRef.current.setPositionAsync(pos);
      setPosition(pos);
    }
  };

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top || (Platform.OS === 'android' ? StatusBar.currentHeight : 0) }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <View style={styles.rootContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Audio Library</Text>
            <Text style={styles.headerSubtitle}>Curated binaural & healing tracks</Text>
          </View>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.back()} testID="audio-back-btn">
            <Feather name="x" size={20} color={COLORS.textBody} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading tracks...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
            }
          >
            {tracks.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="music" size={48} color={COLORS.border} />
                <Text style={styles.emptyText}>No audio tracks available</Text>
              </View>
            ) : (
              tracks.map((track) => (
                <TrackCard
                  key={track.audio_id}
                  track={track}
                  isActive={activeTrackId === track.audio_id}
                  isPlaying={activeTrackId === track.audio_id && isPlaying}
                  position={activeTrackId === track.audio_id ? position : 0}
                  duration={activeTrackId === track.audio_id ? duration : 0}
                  onTogglePlay={() => togglePlay(track)}
                  onSeek={seekTo}
                  formatTime={formatTime}
                />
              ))
            )}
            <View style={{ height: 32 }} />
          </ScrollView>
        )}
        <BottomTabBar />
      </View>
    </View>
  );
}

/* ─── WAVEFORM VISUALIZER ──────────────────── */
function WaveformVisualizer({ isPlaying }: { isPlaying: boolean }) {
  const NUM_BARS = 28;
  const animations = useRef(
    Array.from({ length: NUM_BARS }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    if (isPlaying) {
      const animLoops = animations.map((anim, i) => {
        const baseHeight = 0.2 + Math.random() * 0.3;
        const peakHeight = 0.5 + Math.random() * 0.5;
        const dur = 300 + Math.random() * 400;
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: peakHeight,
              duration: dur,
              delay: i * 30,
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: baseHeight,
              duration: dur * 0.8,
              useNativeDriver: false,
            }),
          ])
        );
      });
      animLoops.forEach((l) => l.start());
      return () => animLoops.forEach((l) => l.stop());
    } else {
      animations.forEach((anim) => {
        Animated.timing(anim, { toValue: 0.15, duration: 300, useNativeDriver: false }).start();
      });
    }
  }, [isPlaying]);

  return (
    <View style={styles.waveformContainer}>
      {animations.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveBar,
            {
              height: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [4, 32],
              }),
              backgroundColor: isPlaying ? COLORS.primary : '#D0C4E0',
            },
          ]}
        />
      ))}
    </View>
  );
}

/* ─── PROGRESS BAR ─────────────────────────── */
function ProgressBar({
  position, duration, onSeek, formatTime,
}: {
  position: number; duration: number;
  onSeek: (ratio: number) => void;
  formatTime: (ms: number) => string;
}) {
  const progress = duration > 0 ? position / duration : 0;
  const [barWidth, setBarWidth] = useState(0);

  const handleSeek = (e: any) => {
    if (barWidth > 0 && duration > 0) {
      const x = e.nativeEvent.locationX;
      const ratio = Math.max(0, Math.min(1, x / barWidth));
      onSeek(ratio);
    }
  };

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressRow}>
        <Text style={styles.progressTime}>{formatTime(position)}</Text>
        <Text style={styles.progressTime}>{formatTime(duration)}</Text>
      </View>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleSeek}
        style={styles.progressBarOuter}
      >
        <View
          style={styles.progressBarTrack}
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
        >
          <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
          <View
            style={[
              styles.progressThumb,
              { left: `${progress * 100}%` },
            ]}
          />
        </View>
      </TouchableOpacity>
    </View>
  );
}

/* ─── TRACK CARD ───────────────────────────── */
function TrackCard({
  track, isActive, isPlaying, position, duration,
  onTogglePlay, onSeek, formatTime,
}: {
  track: AudioTrack;
  isActive: boolean;
  isPlaying: boolean;
  position: number;
  duration: number;
  onTogglePlay: () => void;
  onSeek: (ratio: number) => void;
  formatTime: (ms: number) => string;
}) {
  const labelColor = track.label?.includes('Focus')
    ? '#2563EB' : track.label?.includes('Recovery')
    ? '#059669' : '#9333EA';

  const labelBg = track.label?.includes('Focus')
    ? '#EFF6FF' : track.label?.includes('Recovery')
    ? '#ECFDF5' : '#FAF5FF';

  return (
    <View style={[styles.trackCard, isActive && styles.trackCardActive]} testID={`track-${track.audio_id}`}>
      <View style={styles.trackTopRow}>
        {/* Play button */}
        <TouchableOpacity
          style={[styles.playButton, isPlaying && styles.playButtonActive]}
          onPress={onTogglePlay}
          testID={`play-${track.audio_id}`}
        >
          {isPlaying ? (
            <LinearGradient colors={['#9D4CDD', '#7F00FF']} style={styles.playButtonGradient}>
              <Ionicons name="pause" size={22} color="#FFF" />
            </LinearGradient>
          ) : (
            <View style={styles.playButtonInner}>
              <Ionicons name="play" size={22} color={COLORS.primary} />
            </View>
          )}
        </TouchableOpacity>

        {/* Track info */}
        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
          <View style={styles.trackMeta}>
            <View style={[styles.labelPill, { backgroundColor: labelBg }]}>
              <Text style={[styles.labelText, { color: labelColor }]}>{track.label}</Text>
            </View>
            <Text style={styles.trackDuration}>
              {Math.round(track.duration_sec / 60)} min
            </Text>
          </View>
          {track.desc && !isActive && (
            <Text style={styles.trackDesc} numberOfLines={1}>{track.desc}</Text>
          )}
        </View>
      </View>

      {/* Expanded player when active */}
      {isActive && (
        <View style={styles.expandedPlayer}>
          <WaveformVisualizer isPlaying={isPlaying} />
          <ProgressBar
            position={position}
            duration={duration}
            onSeek={onSeek}
            formatTime={formatTime}
          />
        </View>
      )}
    </View>
  );
}

/* ─── BOTTOM TAB BAR ───────────────────────── */
const TABS = [
  { id: 'home', label: 'Home', icon: 'home', active: false },
  { id: 'favs', label: 'My Favs', icon: 'heart', active: true },
  { id: 'mic', label: '', icon: 'mic', active: false },
  { id: 'progress', label: 'My Progress', icon: 'trending-up', active: false },
  { id: 'you', label: 'You', icon: 'user', active: false },
];

function BottomTabBar() {
  const router = useRouter();

  const handleTab = (tabId: string) => {
    if (tabId === 'home') router.replace('/home');
    if (tabId === 'mic') router.push('/voice');
    if (tabId === 'you') router.push('/profile');
    // favs is current page, do nothing
  };

  return (
    <View style={styles.tabBarContainer} testID="bottom-tab-bar">
      {TABS.map((tab) => {
        if (tab.id === 'mic') {
          return (
            <TouchableOpacity key={tab.id} style={styles.fabWrapper} onPress={() => handleTab('mic')} testID="tab-mic-btn">
              <LinearGradient colors={['#9D4CDD', '#7F00FF']} style={styles.fabButton}>
                <Ionicons name="mic-outline" size={28} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>
          );
        }
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tabItem}
            onPress={() => handleTab(tab.id)}
            testID={`tab-${tab.id}-btn`}
          >
            <Feather name={tab.icon as any} size={22} color={tab.active ? COLORS.primary : COLORS.textBody} />
            <Text style={[styles.tabLabel, tab.active && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ─── STYLES ───────────────────────────────── */
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  rootContainer: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: 'Poppins_700Bold',
    color: COLORS.textHeading,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: COLORS.textBody,
    marginTop: 2,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: COLORS.textBody,
  },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: COLORS.textBody,
  },

  // Track Card
  trackCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  trackCardActive: {
    borderColor: COLORS.primary,
    borderWidth: 1.5,
    backgroundColor: '#FDFAFF',
  },
  trackTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  playButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
  },
  playButtonActive: {},
  playButtonGradient: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: COLORS.textHeading,
    marginBottom: 6,
  },
  trackMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  labelPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  labelText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.3,
  },
  trackDuration: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: COLORS.textBody,
  },
  trackDesc: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: COLORS.textBody,
    marginTop: 6,
  },

  // Expanded Player
  expandedPlayer: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  // Waveform
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    gap: 2,
    marginBottom: 12,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },

  // Progress Bar
  progressContainer: {
    marginTop: 4,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressTime: {
    fontSize: 11,
    fontFamily: 'SpaceMono_400Regular',
    color: COLORS.textBody,
  },
  progressBarOuter: {
    paddingVertical: 8,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: '#EDE5F5',
    borderRadius: 2,
    position: 'relative',
  },
  progressBarFill: {
    height: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  progressThumb: {
    position: 'absolute',
    top: -5,
    marginLeft: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: '#FFF',
  },

  // Bottom Tab Bar
  tabBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: COLORS.tabBarBg,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1,
    borderTopColor: '#EDE5F5',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minWidth: 60,
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: COLORS.textBody,
    marginTop: 4,
  },
  tabLabelActive: { color: COLORS.primary },
  fabWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -30,
  },
  fabButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
