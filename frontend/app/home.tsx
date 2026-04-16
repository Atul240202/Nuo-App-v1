import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Platform,
  StatusBar,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import CircularProgress from '../components/CircularProgress';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const COLORS = {
  background: '#F7F0F5',
  primary: '#7F00FF',
  primaryMuted: '#F0E5FF',
  cardBg: '#FFFFFF',
  textHeading: '#1A1523',
  textBody: '#6E6A7C',
  textInverse: '#FFFFFF',
  successBg: '#E5F5E5',
  successText: '#2E7D32',
  tabBarBg: '#FFFFFF',
  border: '#EDE5F5',
  iconBg: '#F0E5FF',
};

export default function HomeScreen() {
  const [userName, setUserName] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recoveryIndex, setRecoveryIndex] = useState(0);
  const [weeklyMomentum, setWeeklyMomentum] = useState(0);
  const [sleepDebt, setSleepDebt] = useState({ avg: 0, latest: 0, cumulative: 0, records: [] as any[] });
  const [autoRecoveries, setAutoRecoveries] = useState<any[]>([]);
  const [homeMetrics, setHomeMetrics] = useState({ back_to_back: 0, meetings_count: 0, avg_stress_3d: 0, stress_sessions_count: 0 });

  const fetchAutoRecoveries = async () => {
    try {
      // 1. Try fetching today's saved interventions
      const resp = await fetch(`${BACKEND_URL}/api/interventions/today?email=atuljha2402@gmail.com`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.interventions && data.interventions.length > 0) {
          setAutoRecoveries(data.interventions);
          return;
        }
      }
      // 2. If none, generate a new one
      const genResp = await fetch(`${BACKEND_URL}/api/interventions/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'atuljha2402@gmail.com' }),
      });
      if (genResp.ok) {
        const genData = await genResp.json();
        if (genData.intervention) {
          setAutoRecoveries([genData.intervention]);
        }
      }
    } catch {}
  };

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${BACKEND_URL}/api/auth/me`, { credentials: 'include' });
        if (resp.ok) {
          const user = await resp.json();
          const firstName = (user.name || '').split(' ')[0];
          setUserName(firstName || 'there');
        }
      } catch {}
      // Fetch recovery index
      try {
        const resp = await fetch(`${BACKEND_URL}/api/recovery-index?email=atuljha2402@gmail.com`);
        if (resp.ok) {
          const data = await resp.json();
          setRecoveryIndex(data.recovery_index ?? 0);
          setWeeklyMomentum(data.weekly_momentum ?? 0);
        }
      } catch {}
      // Fetch sleep debt
      try {
        const resp = await fetch(`${BACKEND_URL}/api/sleep-debt?email=atuljha2402@gmail.com`);
        if (resp.ok) {
          const data = await resp.json();
          setSleepDebt({
            avg: data.avg_debt_3d ?? 0,
            latest: data.latest_actual_sleep ?? 0,
            cumulative: data.cumulative_debt ?? 0,
            records: data.records ?? [],
          });
        }
      } catch {}
      // Fetch auto recoveries
      await fetchAutoRecoveries();
      // Fetch home metrics (back-to-back, voice stress avg)
      try {
        const resp = await fetch(`${BACKEND_URL}/api/metrics/home?email=atuljha2402@gmail.com`);
        if (resp.ok) {
          const data = await resp.json();
          setHomeMetrics(data);
        }
      } catch {}
    })();
  }, []);

  const toggleRecording = async () => {
    if (isRecording && recording) {
      // Stop
      try {
        await recording.stopAndUnloadAsync();
        const status = await recording.getStatusAsync();
        const duration = status.durationMillis || 0;
        setRecording(null);
        setIsRecording(false);
        // Send to backend
        try {
          await fetch(`${BACKEND_URL}/api/voice/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ duration }),
          });
        } catch {}
      } catch {
        setRecording(null);
        setIsRecording(false);
      }
    } else {
      // Start
      try {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') return;
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording: rec } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        setRecording(rec);
        setIsRecording(true);
      } catch {
        setIsRecording(false);
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <View style={styles.rootContainer}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Header name={userName} />
          <CalendarPill />
          <RecoveryScorecard score={recoveryIndex} momentum={weeklyMomentum} />
          <AutoRecoveries items={autoRecoveries} />
          <HowWeKnowYou sleepDebt={sleepDebt} homeMetrics={homeMetrics} />
          <VentCTA isRecording={isRecording} onPress={toggleRecording} />
        </ScrollView>
        <BottomTabBar isRecording={isRecording} onMicPress={toggleRecording} />
      </View>
    </SafeAreaView>
  );
}

function Header({ name }: { name: string }) {
  const router = useRouter();
  const displayName = name || 'there';
  return (
    <View style={styles.headerRow} testID="header-section">
      <View>
        <Text style={styles.headerGreeting}>Hi, {displayName} 👋</Text>
        <Text style={styles.headerSubtitle}>Nuo knows you're doing great</Text>
      </View>
      <View style={styles.headerIcons}>
        <TouchableOpacity style={styles.headerIconBtn} testID="bluetooth-btn">
          <Feather name="bluetooth" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push('/debug')} testID="help-btn">
          <Feather name="help-circle" size={20} color={COLORS.textBody} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CalendarPill() {
  const router = useRouter();
  return (
    <TouchableOpacity style={styles.calendarPill} onPress={() => router.push('/calendar')} testID="calendar-pill">
      <Feather name="calendar" size={16} color={COLORS.primary} />
      <Text style={styles.calendarText}>Calendar</Text>
      <Feather name="chevron-right" size={14} color={COLORS.textBody} />
    </TouchableOpacity>
  );
}

function RecoveryScorecard({ score, momentum }: { score: number; momentum: number }) {
  const isPositive = momentum >= 0;
  return (
    <View style={styles.scorecardContainer} testID="recovery-scorecard">
      <View style={styles.scorecardRow}>
        <View style={styles.scoreCircleWrapper}>
          <CircularProgress size={140} strokeWidth={12} progress={score} />
          <View style={styles.scoreTextOverlay}>
            <Text style={styles.scoreNumber}>{score}</Text>
            <Text style={styles.scoreMax}>/ 100</Text>
          </View>
        </View>
        <View style={styles.scoreInfoCol}>
          <Text style={styles.scoreTitle}>Recovery Index</Text>
          <Text style={styles.scoreSubtitle}>Based on your last 7 days</Text>
          <View style={[styles.scoreBadge, !isPositive && styles.scoreBadgeNeg]}>
            <Feather name={isPositive ? 'trending-up' : 'trending-down'} size={14} color={isPositive ? COLORS.successText : '#E53E3E'} />
            <Text style={[styles.scoreBadgeText, !isPositive && styles.scoreBadgeTextNeg]}> {isPositive ? '+' : ''}{momentum}%</Text>
            <Text style={styles.scoreBadgeLabel}> this week</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const METRICS = [];

interface SleepData {
  avg: number;
  latest: number;
  cumulative: number;
  records: any[];
}

interface HomeMetrics {
  back_to_back: number;
  meetings_count: number;
  avg_stress_3d: number;
  stress_sessions_count: number;
}

function HowWeKnowYou({ sleepDebt, homeMetrics }: { sleepDebt: SleepData; homeMetrics: HomeMetrics }) {
  const debtLevel = sleepDebt.avg >= 4 ? 'Critical' : sleepDebt.avg >= 2 ? 'High' : 'Normal';
  const debtColor = sleepDebt.avg >= 4 ? '#E53E3E' : sleepDebt.avg >= 2 ? '#DD6B20' : '#38A169';

  // Back-to-back color
  const b2bColor = homeMetrics.back_to_back >= 3 ? '#E53E3E' : homeMetrics.back_to_back >= 1 ? '#DD6B20' : '#38A169';

  // Voice stress color
  const stressAvg = homeMetrics.avg_stress_3d;
  const stressColor = stressAvg >= 70 ? '#E53E3E' : stressAvg >= 45 ? '#DD6B20' : '#38A169';
  const stressLabel = stressAvg >= 70 ? 'High' : stressAvg >= 45 ? 'Moderate' : 'Low';

  return (
    <View style={styles.sectionContainer} testID="how-we-know-you-section">
      <Text style={styles.sectionTitle}>How We Know You</Text>
      <View style={styles.metricsRow}>
        {/* Sleep Debt Card - Real Data */}
        <View style={[styles.metricCard, styles.sleepDebtCard]} testID="sleep-debt-card">
          <View style={[styles.metricIconWrap, { backgroundColor: debtColor + '18' }]}>
            <Feather name="moon" size={20} color={debtColor} />
          </View>
          <Text style={styles.metricLabel}>Sleep Debt</Text>
          <Text style={[styles.metricValue, { color: debtColor }]}>{sleepDebt.avg}h</Text>
          <Text style={styles.metricSub}>avg / 3 days</Text>
          {/* Mini bar chart for 3 days */}
          <View style={styles.miniChart}>
            {sleepDebt.records.map((r: any, i: number) => {
              const barH = Math.max(4, Math.min(28, r.debt_hours * 5.5));
              const barColor = r.debt_hours >= 4 ? '#E53E3E' : r.debt_hours >= 2 ? '#DD6B20' : '#38A169';
              return (
                <View key={i} style={styles.miniBarWrap}>
                  <View style={[styles.miniBar, { height: barH, backgroundColor: barColor }]} />
                  <Text style={styles.miniBarLabel}>{r.debt_hours}h</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Back-to-Back Meetings Card */}
        <View style={styles.metricCard} testID="b2b-meetings-card">
          <View style={[styles.metricIconWrap, { backgroundColor: b2bColor + '18' }]}>
            <Feather name="users" size={20} color={b2bColor} />
          </View>
          <Text style={styles.metricLabel}>Back-to-Back</Text>
          <Text style={[styles.metricValue, { color: b2bColor }]}>{homeMetrics.back_to_back}</Text>
          <Text style={styles.metricSub}>today · {homeMetrics.meetings_count} total</Text>
        </View>

        {/* Voice Stress 3-Day Avg Card */}
        <View style={styles.metricCard} testID="voice-stress-card">
          <View style={[styles.metricIconWrap, { backgroundColor: stressColor + '18' }]}>
            <Feather name="activity" size={20} color={stressColor} />
          </View>
          <Text style={styles.metricLabel}>Voice Stress</Text>
          <Text style={[styles.metricValue, { color: stressColor }]}>{stressAvg}</Text>
          <Text style={styles.metricSub}>{stressLabel} · 3d avg</Text>
        </View>
      </View>
    </View>
  );
}

const PLAN_ITEMS = [
  { id: '1', title: 'Morning Stretch Routine', time: '8:00 AM' },
  { id: '2', title: 'Guided Breathing Session', time: '12:30 PM' },
  { id: '3', title: 'Evening Recovery Walk', time: '6:00 PM' },
];

function AutoRecoveries({ items }: { items: any[] }) {
  const getIcon = (label: string) => {
    if (label?.includes('Focus')) return 'headphones' as const;
    if (label?.includes('Recovery')) return 'moon' as const;
    if (label?.includes('Relax')) return 'wind' as const;
    return 'volume-2' as const;
  };

  return (
    <View style={styles.sectionContainer} testID="auto-recoveries-section">
      <View style={styles.planHeaderRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Feather name="zap" size={18} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>Today's Auto Recoveries</Text>
        </View>
        <View style={styles.doneBadge}>
          <Text style={styles.doneBadgeText}>{items.length} scheduled</Text>
        </View>
      </View>
      {items.length === 0 ? (
        <View style={styles.planCard}>
          <View style={styles.planIconWrap}>
            <Feather name="calendar" size={18} color={COLORS.textBody} />
          </View>
          <View style={styles.planTextCol}>
            <Text style={styles.planTitle}>No interventions yet</Text>
            <Text style={styles.planTime}>Record a voice session to get personalized scheduling</Text>
          </View>
        </View>
      ) : (
        items.map((item: any, idx: number) => (
          <View key={item.audio_id || idx} style={styles.planCard} testID={`recovery-card-${idx}`}>
            <View style={styles.planIconWrap}>
              <Feather name={getIcon(item.audio_label)} size={18} color={COLORS.primary} />
            </View>
            <View style={styles.planTextCol}>
              <Text style={styles.planTitle}>{item.audio_title || 'Scheduled Session'}</Text>
              <Text style={styles.planTime}>{item.start_time} · {item.duration_min || 10} min</Text>
              {item.reason ? (
                <Text style={styles.planReason} numberOfLines={2}>{item.reason}</Text>
              ) : null}
            </View>
            <View style={styles.timeBadge}>
              <Text style={styles.timeBadgeText}>{item.audio_label || 'Recovery'}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function VentCTA({ isRecording, onPress }: { isRecording: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.9} disabled testID="tribe-cta-btn">
      <LinearGradient
        colors={['#9D4CDD', '#7F00FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.ventBanner}
      >
        <View style={styles.ventMicCircle}>
          <Ionicons name="people-outline" size={28} color="#FFF" />
        </View>
        <View style={styles.ventTextCol}>
          <Text style={styles.ventTitle}>Find My Tribe</Text>
          <Text style={styles.ventSubtitle}>Connect with people who get it — coming soon</Text>
        </View>
        <View style={styles.comingSoonBadge}>
          <Text style={styles.comingSoonText}>Soon</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const TABS = [
  { id: 'home', label: 'Home', icon: 'home', active: true },
  { id: 'favs', label: 'My Favs', icon: 'heart', active: false },
  { id: 'mic', label: '', icon: 'mic', active: false },
  { id: 'progress', label: 'My Progress', icon: 'trending-up', active: false },
  { id: 'you', label: 'You', icon: 'user', active: false },
];

function BottomTabBar({ isRecording, onMicPress }: { isRecording: boolean; onMicPress: () => void }) {
  const router = useRouter();
  const heartbeat = useRef(new Animated.Value(1)).current;
  const pulseRing = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Heartbeat: always animate the mic FAB — smooth scale 1→1.25→1 looping
    const heartbeatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(heartbeat, { toValue: 1.25, duration: 600, useNativeDriver: true }),
        Animated.timing(heartbeat, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(heartbeat, { toValue: 1.18, duration: 500, useNativeDriver: true }),
        Animated.timing(heartbeat, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    heartbeatLoop.start();

    if (isRecording) {
      // Pulse ring expand + fade (only when recording)
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseRing, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseRing, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseRing.stopAnimation();
      pulseRing.setValue(0);
    }

    return () => { heartbeatLoop.stop(); };
  }, [isRecording]);

  const ringScale = pulseRing.interpolate({ inputRange: [0, 1], outputRange: [1, 2] });
  const ringOpacity = pulseRing.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0.5, 0.1, 0] });

  const handleTabPress = (tabId: string) => {
    if (tabId === 'favs') router.push('/audio-library');
    if (tabId === 'you') router.push('/profile');
    if (tabId === 'progress') router.push('/progress');
    // home is current page — do nothing
  };

  return (
    <View style={styles.tabBarContainer} testID="bottom-tab-bar">
      {TABS.map((tab) => {
        if (tab.id === 'mic') {
          return (
            <TouchableOpacity key={tab.id} style={styles.fabWrapper} onPress={() => router.push('/voice')} testID="tab-mic-btn">
              {/* Pulse ring behind FAB when recording */}
              {isRecording && (
                <Animated.View
                  style={[
                    styles.pulseRing,
                    { transform: [{ scale: ringScale }], opacity: ringOpacity },
                  ]}
                />
              )}
              <Animated.View style={{ transform: [{ scale: heartbeat }] }}>
                <LinearGradient
                  colors={isRecording ? ['#FF4466', '#CC2244'] : ['#9D4CDD', '#7F00FF']}
                  style={styles.fabButton}
                >
                  <Ionicons name={isRecording ? 'stop' : 'mic-outline'} size={28} color="#FFF" />
                </LinearGradient>
              </Animated.View>
            </TouchableOpacity>
          );
        }
        return (
          <TouchableOpacity key={tab.id} style={styles.tabItem} onPress={() => handleTabPress(tab.id)} testID={`tab-${tab.id}-btn`}>
            <Feather name={tab.icon as any} size={22} color={tab.active ? COLORS.primary : COLORS.textBody} />
            <Text style={[styles.tabLabel, tab.active && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  rootContainer: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerGreeting: {
    fontSize: 28,
    fontFamily: 'Poppins_700Bold',
    color: COLORS.textHeading,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: COLORS.textBody,
    marginTop: 2,
  },
  headerIcons: { flexDirection: 'row', gap: 12 },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7F00FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  calendarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    gap: 8,
    marginBottom: 20,
    shadowColor: '#7F00FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  calendarText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: COLORS.textHeading,
  },
  scorecardContainer: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 24,
    padding: 24,
    marginBottom: 28,
    shadowColor: '#7F00FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scorecardRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  scoreCircleWrapper: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  scoreTextOverlay: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  scoreNumber: {
    fontSize: 36,
    fontFamily: 'Poppins_700Bold',
    color: COLORS.textHeading,
    lineHeight: 40,
  },
  scoreMax: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: COLORS.textBody,
    marginTop: -2,
  },
  scoreInfoCol: { flex: 1 },
  scoreTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
    color: COLORS.textHeading,
    marginBottom: 4,
  },
  scoreSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: COLORS.textBody,
    marginBottom: 10,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.successBg,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  scoreBadgeNeg: {
    backgroundColor: '#FEE2E2',
  },
  scoreBadgeText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: COLORS.successText,
  },
  scoreBadgeTextNeg: {
    color: '#E53E3E',
  },
  scoreBadgeLabel: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: COLORS.textBody,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
  },
  dot: { backgroundColor: '#C4B5D9' },
  sectionContainer: { marginBottom: 28 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Poppins_600SemiBold',
    color: COLORS.textHeading,
    letterSpacing: -0.3,
  },
  recoveryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#7F00FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recoveryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.iconBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  recoveryTextCol: { flex: 1 },
  recoveryTitle: {
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
    color: COLORS.textHeading,
    marginBottom: 2,
  },
  recoverySubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: COLORS.textBody,
  },
  timeBadge: {
    backgroundColor: '#F5F0FA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 8,
  },
  timeBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: COLORS.textBody,
  },
  metricsRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    shadowColor: '#7F00FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metricIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.iconBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  metricLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: COLORS.textBody,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
    color: COLORS.textHeading,
    marginBottom: 2,
  },
  metricSub: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: COLORS.textBody,
  },
  sleepDebtCard: {
    paddingBottom: 10,
  },
  miniChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    height: 36,
  },
  miniBarWrap: {
    alignItems: 'center',
  },
  miniBar: {
    width: 14,
    borderRadius: 4,
  },
  miniBarLabel: {
    fontSize: 8,
    fontFamily: 'Inter_500Medium',
    color: COLORS.textBody,
    marginTop: 2,
  },
  planHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  doneBadge: {
    backgroundColor: '#F5F0FA',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  doneBadgeText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: COLORS.textBody,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#7F00FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  planIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.iconBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  planTextCol: { flex: 1 },
  planTitle: {
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
    color: COLORS.textHeading,
    marginBottom: 2,
  },
  planTime: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: COLORS.textBody,
  },
  planReason: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: COLORS.textBody,
    marginTop: 4,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  planActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F5F0FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ventBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    padding: 20,
    marginBottom: 28,
  },
  ventMicCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  ventTextCol: { flex: 1 },
  ventTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
    color: COLORS.textInverse,
    marginBottom: 4,
  },
  ventSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.85)',
  },
  comingSoonBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  comingSoonText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  tabBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: COLORS.tabBarBg,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1,
    borderTopColor: '#EDE5F5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 8,
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
  pulseRing: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF4466',
  },
  fabButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7F00FF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
});
