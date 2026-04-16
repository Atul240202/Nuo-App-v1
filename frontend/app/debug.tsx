import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  Platform, StatusBar, SafeAreaView, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LIGHT } from '../constants/theme';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface CalEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  status: string;
  location: string;
}

export default function DebugScreen() {
  const router = useRouter();
  const [calConnected, setCalConnected] = useState(false);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authUrl, setAuthUrl] = useState('');

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(`${BACKEND_URL}/api/calendar/events?email=atuljha2402@gmail.com`);
      if (resp.ok) {
        const data = await resp.json();
        setEvents(data.events || []);
        setCalConnected(true);
      } else {
        const err = await resp.json();
        setCalConnected(false);
        setError(err.detail || 'Calendar not connected');
      }
    } catch {
      setError('Failed to fetch');
    }
    setLoading(false);
  };

  const connectCalendar = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${BACKEND_URL}/api/calendar/auth`);
      const data = await resp.json();
      if (data.auth_url) {
        if (Platform.OS === 'web') {
          window.open(data.auth_url, '_blank');
        } else {
          Linking.openURL(data.auth_url);
        }
      }
    } catch {
      setError('Failed to start calendar auth');
    }
    setLoading(false);
  };

  const formatTime = (iso: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="debug-back-btn">
          <Feather name="arrow-left" size={22} color={LIGHT.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Debug — Calendar</Text>
        <TouchableOpacity onPress={fetchEvents} style={styles.refreshBtn} testID="debug-refresh-btn">
          <Feather name="refresh-cw" size={20} color={LIGHT.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Status */}
        <View style={styles.statusCard}>
          <View style={[styles.statusDot, calConnected ? styles.dotGreen : styles.dotRed]} />
          <Text style={styles.statusText}>
            {calConnected ? 'Calendar Connected' : 'Calendar Not Connected'}
          </Text>
        </View>

        <Text style={styles.emailLabel}>Email: atuljha2402@gmail.com</Text>

        {/* Connect button */}
        {!calConnected && (
          <TouchableOpacity style={styles.connectBtn} onPress={connectCalendar} disabled={loading} testID="connect-calendar-btn">
            <Feather name="calendar" size={18} color="#FFF" />
            <Text style={styles.connectBtnText}>
              {loading ? 'Opening...' : 'Connect Google Calendar'}
            </Text>
          </TouchableOpacity>
        )}

        {/* After connecting, show refresh hint */}
        {!calConnected && !loading && (
          <Text style={styles.hint}>
            After granting access, tap the refresh icon above to load events.
          </Text>
        )}

        {/* Error */}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Loading */}
        {loading && <ActivityIndicator size="large" color={LIGHT.accent} style={styles.loader} />}

        {/* Events */}
        {calConnected && events.length === 0 && !loading && (
          <Text style={styles.emptyText}>No events in the next 7 days</Text>
        )}

        {events.map((ev) => (
          <View key={ev.id} style={styles.eventCard} testID={`event-${ev.id}`}>
            <View style={styles.eventDot} />
            <View style={styles.eventContent}>
              <Text style={styles.eventTitle}>{ev.summary}</Text>
              <Text style={styles.eventTime}>{formatTime(ev.start)}</Text>
              {ev.end ? <Text style={styles.eventTimeEnd}>→ {formatTime(ev.end)}</Text> : null}
              {ev.location ? <Text style={styles.eventLocation}>{ev.location}</Text> : null}
              <Text style={styles.eventStatus}>{ev.status}</Text>
            </View>
          </View>
        ))}

        {/* Raw JSON */}
        {events.length > 0 && (
          <View style={styles.rawSection}>
            <Text style={styles.rawTitle}>Raw API Response ({events.length} events)</Text>
            <View style={styles.rawBox}>
              <Text style={styles.rawText}>{JSON.stringify(events, null, 2)}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: LIGHT.bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: LIGHT.border },
  backBtn: { padding: 8, marginRight: 12 },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: 'Poppins_600SemiBold', color: LIGHT.text },
  refreshBtn: { padding: 8 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  statusCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: LIGHT.bgSoft, borderRadius: 12, padding: 14, marginBottom: 12 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  dotGreen: { backgroundColor: '#22C55E' },
  dotRed: { backgroundColor: '#EF4444' },
  statusText: { fontSize: 15, fontFamily: 'Inter_500Medium', color: LIGHT.text },
  emailLabel: { fontSize: 13, fontFamily: 'Inter_400Regular', color: LIGHT.textMuted, marginBottom: 16 },
  connectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#7F00FF', borderRadius: 12, paddingVertical: 14, marginBottom: 12,
  },
  connectBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#FFF' },
  hint: { fontSize: 13, fontFamily: 'Inter_400Regular', color: LIGHT.textDim, textAlign: 'center', marginBottom: 16 },
  errorText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#EF4444', marginBottom: 12 },
  loader: { marginVertical: 20 },
  emptyText: { fontSize: 15, fontFamily: 'Inter_400Regular', color: LIGHT.textMuted, textAlign: 'center', marginTop: 40 },
  eventCard: {
    flexDirection: 'row', backgroundColor: LIGHT.bgSoft, borderRadius: 14, padding: 14,
    marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#7F00FF',
  },
  eventDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7F00FF', marginTop: 6, marginRight: 12 },
  eventContent: { flex: 1 },
  eventTitle: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: LIGHT.text, marginBottom: 4 },
  eventTime: { fontSize: 13, fontFamily: 'Inter_400Regular', color: LIGHT.accent },
  eventTimeEnd: { fontSize: 12, fontFamily: 'Inter_400Regular', color: LIGHT.textMuted },
  eventLocation: { fontSize: 12, fontFamily: 'Inter_400Regular', color: LIGHT.textDim, marginTop: 4 },
  eventStatus: { fontSize: 11, fontFamily: 'Inter_500Medium', color: LIGHT.textDim, marginTop: 4, textTransform: 'uppercase' },
  rawSection: { marginTop: 24 },
  rawTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: LIGHT.textMuted, marginBottom: 8 },
  rawBox: { backgroundColor: '#1A1523', borderRadius: 12, padding: 14 },
  rawText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#9D6CFF', lineHeight: 16 },
});
