import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform,
  StatusBar, ActivityIndicator, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { apiFetch } from '../utils/api';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const C = {
  bg: '#F7F0F5',
  primary: '#7F00FF',
  primaryLight: '#F0E5FF',
  card: '#FFFFFF',
  heading: '#1A1523',
  body: '#6E6A7C',
  dim: '#B0AABA',
  border: '#EDE5F5',
  green: '#22C55E',
  greenBg: '#F0FDF4',
  orange: '#F59E0B',
  orangeBg: '#FFFBEB',
  red: '#EF4444',
};

type Period = 'week' | 'month' | 'year';

export default function ProgressScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>('week');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [interventions, setInterventions] = useState<any>(null);
  const [achievements, setAchievements] = useState<any[]>([]);

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const [sumResp, intResp, achResp] = await Promise.all([
        apiFetch(`/api/progress/summary?period=${p}`),
        apiFetch(`/api/interventions/count?period=${p}`),
        apiFetch(`/api/achievements`),
      ]);
      if (sumResp.ok) setSummary(await sumResp.json());
      if (intResp.ok) setInterventions(await intResp.json());
      if (achResp.ok) setAchievements(await achResp.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(period); }, [period, fetchData]);

  const handlePeriod = (p: Period) => setPeriod(p);

  return (
    <View style={[styles.container, { paddingTop: insets.top || (Platform.OS === 'android' ? StatusBar.currentHeight : 0) }]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} testID="progress-back">
          <Feather name="arrow-left" size={22} color={C.heading} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Progress</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <SkeletonLoader />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Recovery Index Card */}
          <RecoveryRingCard score={summary?.score || 50} weeklyChange={summary?.weekly_change || 0} />

          {/* Period Selector */}
          <PeriodSelector active={period} onChange={handlePeriod} />

          {/* Chart */}
          <WeeklyChart data={summary?.chart_data || []} />

          {/* Health Metrics Grid */}
          <MetricsGrid metrics={summary?.metrics || []} />

          {/* Intervention Count */}
          <InterventionCard data={interventions} />

          {/* Achievements */}
          <AchievementsSection items={achievements} />

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Bottom Tab Bar */}
      <BottomTabBar />
    </View>
  );
}

/* ─── SKELETON LOADER ──────────────────────── */
function SkeletonLoader() {
  const pulse = useState(new Animated.Value(0.3))[0];
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const SkeletonBox = ({ width, height, style }: any) => (
    <Animated.View style={[{ width, height, borderRadius: 12, backgroundColor: C.border, opacity: pulse }, style]} />
  );

  return (
    <View style={{ padding: 20, gap: 20 }}>
      <SkeletonBox width="100%" height={200} />
      <SkeletonBox width="100%" height={48} />
      <SkeletonBox width="100%" height={180} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <SkeletonBox width="48%" height={100} />
        <SkeletonBox width="48%" height={100} />
      </View>
    </View>
  );
}

/* ─── RECOVERY RING CARD ───────────────────── */
function RecoveryRingCard({ score, weeklyChange }: { score: number; weeklyChange: number }) {
  const size = 140;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const isPositive = weeklyChange >= 0;

  return (
    <View style={styles.ringCard} testID="recovery-ring-card">
      <View style={styles.ringRow}>
        <View style={styles.ringWrap}>
          <Svg width={size} height={size}>
            <Circle cx={size / 2} cy={size / 2} r={radius} stroke={C.border} strokeWidth={stroke} fill="none" />
            <Circle
              cx={size / 2} cy={size / 2} r={radius}
              stroke={C.primary}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${progress} ${circumference - progress}`}
              strokeDashoffset={circumference / 4}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </Svg>
          <View style={styles.ringCenter}>
            <Text style={styles.ringScore}>{score}</Text>
            <Text style={styles.ringLabel}>Recovery</Text>
          </View>
        </View>
        <View style={styles.ringInfo}>
          <Text style={styles.ringInfoTitle}>Recovery Index</Text>
          <View style={[styles.changeBadge, isPositive ? styles.changeBadgeGreen : styles.changeBadgeOrange]}>
            <Feather name={isPositive ? 'trending-up' : 'trending-down'} size={14} color={isPositive ? C.green : C.orange} />
            <Text style={[styles.changeText, { color: isPositive ? C.green : C.orange }]}>
              {isPositive ? '+' : ''}{weeklyChange}%
            </Text>
          </View>
          <Text style={styles.ringSubtitle}>Based on last 7 days</Text>
        </View>
      </View>
    </View>
  );
}

/* ─── PERIOD SELECTOR ──────────────────────── */
function PeriodSelector({ active, onChange }: { active: Period; onChange: (p: Period) => void }) {
  const periods: Period[] = ['week', 'month', 'year'];
  return (
    <View style={styles.periodRow}>
      {periods.map((p) => (
        <TouchableOpacity
          key={p}
          style={[styles.periodBtn, active === p && styles.periodBtnActive]}
          onPress={() => onChange(p)}
          testID={`period-${p}`}
        >
          <Text style={[styles.periodText, active === p && styles.periodTextActive]}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/* ─── WEEKLY BAR CHART ─────────────────────── */
function WeeklyChart({ data }: { data: any[] }) {
  const maxScore = Math.max(...data.map(d => d.score), 1);

  return (
    <View style={styles.chartCard} testID="weekly-chart">
      <Text style={styles.chartTitle}>Trend</Text>
      <View style={styles.chartBars}>
        {data.map((d, i) => {
          const barH = Math.max(8, (d.score / maxScore) * 120);
          return (
            <View key={i} style={styles.barCol}>
              <Text style={styles.barValue}>{d.score || '-'}</Text>
              {d.is_today ? (
                <LinearGradient colors={['#9D4CDD', '#7F00FF']} style={[styles.bar, { height: barH }]} />
              ) : (
                <View style={[styles.bar, { height: barH, backgroundColor: d.score > 0 ? C.border : '#F0ECF5' }]} />
              )}
              <Text style={[styles.barLabel, d.is_today && styles.barLabelActive]}>{d.day}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ─── METRICS GRID ─────────────────────────── */
function MetricsGrid({ metrics }: { metrics: any[] }) {
  const getIcon = (label: string) => {
    if (label.includes('Sleep')) return 'moon';
    if (label.includes('Stress')) return 'activity';
    if (label.includes('Energy')) return 'zap';
    if (label.includes('Meeting')) return 'users';
    return 'heart';
  };

  return (
    <View style={styles.metricsSection}>
      <Text style={styles.sectionTitle}>Health Metrics</Text>
      <View style={styles.metricsGrid}>
        {metrics.map((m, i) => (
          <View key={i} style={styles.metricCard} testID={`metric-${i}`}>
            <View style={styles.metricTopRow}>
              <View style={styles.metricIconWrap}>
                <Feather name={getIcon(m.label) as any} size={16} color={C.primary} />
              </View>
              {m.trend !== 'stable' && (
                <View style={[styles.metricTrend, m.trend === 'up' ? (m.label.includes('Stress') ? styles.trendBad : styles.trendGood) : (m.label.includes('Stress') ? styles.trendGood : styles.trendBad)]}>
                  <Feather name={m.trend === 'up' ? 'arrow-up' : 'arrow-down'} size={10} color={m.trend === 'up' ? (m.label.includes('Stress') ? C.orange : C.green) : (m.label.includes('Stress') ? C.green : C.orange)} />
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: m.trend === 'up' ? (m.label.includes('Stress') ? C.orange : C.green) : (m.label.includes('Stress') ? C.green : C.orange) }}>
                    {Math.abs(m.change)}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.metricValue}>{m.value}</Text>
            <Text style={styles.metricUnit}>{m.unit}</Text>
            <Text style={styles.metricLabel}>{m.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ─── INTERVENTION CARD ────────────────────── */
function InterventionCard({ data }: { data: any }) {
  if (!data) return null;

  return (
    <View style={styles.interventionCard} testID="intervention-count-card">
      <View style={styles.interventionHeader}>
        <Text style={styles.sectionTitle}>AI Interventions</Text>
        <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeText}>{data.total} total</Text>
        </View>
      </View>
      <View style={styles.breakdownRow}>
        {data.breakdown.map((b: any, i: number) => (
          <View key={i} style={styles.breakdownItem}>
            <View style={styles.breakdownIconWrap}>
              <Feather name={b.icon as any} size={18} color={C.primary} />
            </View>
            <Text style={styles.breakdownCount}>{b.count}</Text>
            <Text style={styles.breakdownType}>{b.type}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ─── ACHIEVEMENTS SECTION ─────────────────── */
function AchievementsSection({ items }: { items: any[] }) {
  if (!items.length) return null;

  return (
    <View style={styles.achieveSection}>
      <Text style={styles.sectionTitle}>Achievements</Text>
      {items.map((a) => (
        <View
          key={a.id}
          style={[styles.achieveCard, !a.unlocked && styles.achieveCardLocked]}
          testID={`achieve-${a.id}`}
        >
          <View style={[styles.achieveIconWrap, a.unlocked ? styles.achieveIconUnlocked : styles.achieveIconLocked]}>
            <Feather name={a.icon as any} size={18} color={a.unlocked ? '#FFF' : C.dim} />
          </View>
          <View style={styles.achieveTextCol}>
            <Text style={[styles.achieveTitle, !a.unlocked && { color: C.dim }]}>{a.title}</Text>
            <Text style={styles.achieveDesc}>{a.description}</Text>
          </View>
          {a.unlocked && (
            <View style={styles.achieveCheck}>
              <Feather name="check-circle" size={22} color={C.primary} />
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

/* ─── BOTTOM TAB BAR ───────────────────────── */
const TABS = [
  { id: 'home', label: 'Home', icon: 'home', active: false },
  { id: 'favs', label: 'My Favs', icon: 'heart', active: false },
  { id: 'mic', label: '', icon: 'mic', active: false },
  { id: 'progress', label: 'My Progress', icon: 'trending-up', active: true },
  { id: 'you', label: 'You', icon: 'user', active: false },
];

function BottomTabBar() {
  const router = useRouter();
  const handleTab = (id: string) => {
    if (id === 'home') router.replace('/home');
    if (id === 'favs') router.push('/audio-library');
    if (id === 'mic') router.push('/voice');
    if (id === 'you') router.push('/profile');
  };

  return (
    <View style={styles.tabBar}>
      {TABS.map((t) => {
        if (t.id === 'mic') {
          return (
            <TouchableOpacity key={t.id} style={styles.fabWrap} onPress={() => handleTab('mic')}>
              <LinearGradient colors={['#9D4CDD', '#7F00FF']} style={styles.fabBtn}>
                <Ionicons name="mic-outline" size={28} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>
          );
        }
        return (
          <TouchableOpacity key={t.id} style={styles.tabItem} onPress={() => handleTab(t.id)}>
            <Feather name={t.icon as any} size={22} color={t.active ? C.primary : C.body} />
            <Text style={[styles.tabLabel, t.active && { color: C.primary }]}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ─── STYLES ───────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: C.heading },
  loadingWrap: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },

  // Ring Card
  ringCard: { backgroundColor: C.card, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  ringWrap: { position: 'relative', width: 140, height: 140 },
  ringCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringScore: { fontSize: 36, fontFamily: 'Poppins_700Bold', color: C.primary },
  ringLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.body, marginTop: -2 },
  ringInfo: { flex: 1, gap: 8 },
  ringInfoTitle: { fontSize: 18, fontFamily: 'Poppins_600SemiBold', color: C.heading },
  changeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start' },
  changeBadgeGreen: { backgroundColor: C.greenBg },
  changeBadgeOrange: { backgroundColor: C.orangeBg },
  changeText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  ringSubtitle: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.dim },

  // Period Selector
  periodRow: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 14, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  periodBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  periodBtnActive: { backgroundColor: C.primary },
  periodText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.body },
  periodTextActive: { color: '#FFF' },

  // Chart
  chartCard: { backgroundColor: C.card, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  chartTitle: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: C.heading, marginBottom: 16 },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 160 },
  barCol: { alignItems: 'center', flex: 1, gap: 4 },
  barValue: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: C.body },
  bar: { width: 24, borderRadius: 6, minHeight: 8 },
  barLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.dim },
  barLabelActive: { color: C.primary, fontFamily: 'Inter_600SemiBold' },

  // Metrics
  metricsSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: C.heading, marginBottom: 12 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricCard: { width: '47%', backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
  metricTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  metricIconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  metricTrend: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  trendGood: { backgroundColor: C.greenBg },
  trendBad: { backgroundColor: C.orangeBg },
  metricValue: { fontSize: 28, fontFamily: 'Poppins_700Bold', color: C.heading },
  metricUnit: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.dim, marginTop: -4 },
  metricLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.body, marginTop: 4 },

  // Intervention
  interventionCard: { backgroundColor: C.card, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  interventionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  totalBadge: { backgroundColor: C.primaryLight, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  totalBadgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.primary },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-around' },
  breakdownItem: { alignItems: 'center', gap: 6 },
  breakdownIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  breakdownCount: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: C.heading },
  breakdownType: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.body, textAlign: 'center', maxWidth: 80 },

  // Achievements
  achieveSection: { marginBottom: 16 },
  achieveCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border, gap: 14 },
  achieveCardLocked: { opacity: 0.6 },
  achieveIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  achieveIconUnlocked: { backgroundColor: C.primary },
  achieveIconLocked: { backgroundColor: C.border },
  achieveTextCol: { flex: 1 },
  achieveTitle: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: C.heading },
  achieveDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.body, marginTop: 2 },
  achieveCheck: {},

  // Tab bar
  tabBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: C.card, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  tabItem: { alignItems: 'center', justifyContent: 'center', paddingVertical: 4, minWidth: 60 },
  tabLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.body, marginTop: 4 },
  fabWrap: { alignItems: 'center', justifyContent: 'center', marginTop: -30 },
  fabBtn: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
});
