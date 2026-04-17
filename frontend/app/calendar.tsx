import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  Platform, StatusBar, Linking, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiFetch } from '../utils/api';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const COLORS = {
  background: '#F7F0F5',
  primary: '#7F00FF',
  cardBg: '#FFFFFF',
  textHeading: '#1A1523',
  textBody: '#6E6A7C',
  textDim: '#B0AABA',
  border: '#EDE5F5',
  successBg: '#E5F5E5',
  successText: '#2E7D32',
  warningBg: '#FFF7ED',
  warningText: '#C2410C',
};

interface CalEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  status: string;
  location: string;
}

export default function CalendarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => { fetchEvents(); }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const resp = await apiFetch(`/api/calendar/events`);
      if (resp.ok) {
        const data = await resp.json();
        setEvents(data.events || []);
        setConnected(true);
      } else {
        setConnected(false);
      }
    } catch {
      setConnected(false);
    }
    setLoading(false);
  };

  const reconnectCalendar = async () => {
    setLoading(true);
    try {
      const resp = await apiFetch(`/api/calendar/auth?source=calendar`);
      if (!resp.ok) throw new Error();
      const data = await resp.json();
      if (data.auth_url) {
        if (Platform.OS === 'web') {
          window.open(data.auth_url, '_blank');
        } else {
          Linking.openURL(data.auth_url);
        }
      }
    } catch {}
    setLoading(false);
  };

  const handleClose = async () => {
    // Recalculate metrics and save to MongoDB before closing
    setRecalculating(true);
    try {
      const resp = await apiFetch(`/api/calendar/recalculate`, {
        method: 'POST',
        jsonBody: {},
      });
      if (resp.ok) {
        const data = await resp.json();
        setMetrics(data.metrics);
      }
    } catch {}
    setRecalculating(false);
    router.back();
  };

  const formatTime = (iso: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  const getDuration = (start: string, end: string) => {
    try {
      const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
      if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
      return `${mins}m`;
    } catch { return ''; }
  };

  const todayEvents = events.filter(e => {
    try {
      const d = new Date(e.start);
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    } catch { return false; }
  });

  const totalMeetingMins = todayEvents.reduce((acc, e) => {
    try {
      return acc + Math.round((new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000);
    } catch { return acc; }
  }, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top || (Platform.OS === 'android' ? StatusBar.currentHeight : 0) }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="cal-back-btn">
          <Feather name="arrow-left" size={22} color={COLORS.textHeading} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calendar</Text>
        <TouchableOpacity
          onPress={handleClose}
          style={styles.closeBtn}
          disabled={recalculating}
          testID="cal-close-btn"
        >
          {recalculating ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <LinearGradient colors={['#9D4CDD', '#7F00FF']} style={styles.closeBtnGradient}>
              <Feather name="check" size={18} color="#FFF" />
            </LinearGradient>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Connection Status */}
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, connected ? styles.dotGreen : styles.dotRed]} />
          <Text style={styles.statusText}>{connected ? 'Calendar Synced' : 'Not Connected'}</Text>
        </View>

        {/* Reconnect Button */}
        <TouchableOpacity style={styles.reconnectBtn} onPress={reconnectCalendar} testID="reconnect-btn">
          <Feather name="refresh-cw" size={16} color={COLORS.primary} />
          <Text style={styles.reconnectText}>Reconnect Calendar</Text>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading events...</Text>
          </View>
        ) : !connected ? (
          <View style={styles.emptyWrap}>
            <Feather name="calendar" size={48} color={COLORS.border} />
            <Text style={styles.emptyTitle}>Calendar Not Connected</Text>
            <Text style={styles.emptyDesc}>Tap "Reconnect Calendar" above to sync your Google Calendar</Text>
          </View>
        ) : (
          <>
            {/* Summary Cards */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{todayEvents.length}</Text>
                <Text style={styles.summaryLabel}>Meetings</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{totalMeetingMins >= 60 ? `${Math.floor(totalMeetingMins / 60)}h` : `${totalMeetingMins}m`}</Text>
                <Text style={styles.summaryLabel}>Total Time</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{todayEvents.length > 0 ? formatTime(todayEvents[todayEvents.length - 1].end) : '-'}</Text>
                <Text style={styles.summaryLabel}>Day Ends</Text>
              </View>
            </View>

            {/* Today's Events */}
            <Text style={styles.sectionTitle}>Today's Meetings</Text>
            {todayEvents.length === 0 ? (
              <View style={styles.noEventsCard}>
                <Feather name="sun" size={24} color={COLORS.successText} />
                <Text style={styles.noEventsText}>No meetings today. Light day ahead.</Text>
              </View>
            ) : (
              todayEvents.map((ev, idx) => (
                <View key={ev.id || idx} style={styles.eventCard} testID={`event-${idx}`}>
                  <View style={styles.timelineCol}>
                    <View style={styles.timelineDot} />
                    {idx < todayEvents.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={styles.eventContent}>
                    <View style={styles.eventTimeRow}>
                      <Text style={styles.eventTime}>{formatTime(ev.start)} – {formatTime(ev.end)}</Text>
                      <Text style={styles.eventDuration}>{getDuration(ev.start, ev.end)}</Text>
                    </View>
                    <Text style={styles.eventTitle}>{ev.summary || '(No title)'}</Text>
                    {ev.location ? (
                      <View style={styles.eventLocationRow}>
                        <Feather name="map-pin" size={12} color={COLORS.textDim} />
                        <Text style={styles.eventLocation}>{ev.location}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))
            )}

            {/* Past Events */}
            {events.filter(e => !todayEvents.includes(e)).length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Past 7 Days</Text>
                {events.filter(e => !todayEvents.includes(e)).slice(0, 10).map((ev, idx) => (
                  <View key={ev.id || `past-${idx}`} style={styles.pastEventCard}>
                    <Text style={styles.pastEventTime}>{formatTime(ev.start)}</Text>
                    <Text style={styles.pastEventTitle} numberOfLines={1}>{ev.summary || '(No title)'}</Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {/* Close hint */}
        <View style={styles.closeHintWrap}>
          <Feather name="info" size={14} color={COLORS.textDim} />
          <Text style={styles.closeHintText}>Tap the check button to recalculate metrics and return home</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 8, marginRight: 8 },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
    color: COLORS.textHeading,
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  closeBtnGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  dotGreen: { backgroundColor: '#22C55E' },
  dotRed: { backgroundColor: '#EF4444' },
  statusText: { fontSize: 15, fontFamily: 'Inter_500Medium', color: COLORS.textHeading },
  reconnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  reconnectText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: COLORS.primary,
  },
  loadingWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 16 },
  loadingText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: COLORS.textBody },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: 'Poppins_600SemiBold', color: COLORS.textHeading },
  emptyDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', color: COLORS.textBody, textAlign: 'center', paddingHorizontal: 20 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryValue: {
    fontSize: 22,
    fontFamily: 'Poppins_700Bold',
    color: COLORS.primary,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: COLORS.textBody,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: COLORS.textHeading,
    marginBottom: 14,
  },
  noEventsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.successBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  noEventsText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: COLORS.successText },
  eventCard: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  timelineCol: {
    width: 24,
    alignItems: 'center',
    paddingTop: 6,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.border,
    marginTop: 4,
  },
  eventContent: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: 14,
    marginLeft: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  eventTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventTime: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: COLORS.primary,
  },
  eventDuration: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: COLORS.textDim,
    backgroundColor: '#F5F0FA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  eventTitle: {
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
    color: COLORS.textHeading,
  },
  eventLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  eventLocation: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: COLORS.textDim,
  },
  pastEventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pastEventTime: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: COLORS.textDim,
    width: 65,
  },
  pastEventTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: COLORS.textBody,
  },
  closeHintWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 4,
  },
  closeHintText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: COLORS.textDim,
    flex: 1,
  },
});
