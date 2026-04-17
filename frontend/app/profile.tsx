import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform,
  StatusBar, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../utils/api';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const COLORS = {
  background: '#F7F0F5',
  primary: '#7F00FF',
  primaryLight: '#F0E5FF',
  cardBg: '#FFFFFF',
  textHeading: '#1A1523',
  textBody: '#6E6A7C',
  textDim: '#B0AABA',
  border: '#EDE5F5',
  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  success: '#22C55E',
  successLight: '#F0FDF4',
};

interface UserData {
  email: string;
  name: string;
  picture: string;
  personalization: any;
  calendar_synced: boolean;
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: ctxUser, logout } = useAuth();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser();
  }, [ctxUser]);

  const fetchUser = async () => {
    try {
      // Use AuthContext user if available
      if (ctxUser) {
        setUser({
          email: ctxUser.email || '',
          name: ctxUser.name || '',
          picture: ctxUser.picture || '',
          personalization: ctxUser.personalization || null,
          calendar_synced: !!ctxUser.google_calendar_tokens || !!(ctxUser as any).calendar_synced,
        });
        setLoading(false);
        return;
      }
      // Fallback to /auth/me
      const resp = await apiFetch(`/api/auth/me`);
      if (resp.ok) {
        const data = await resp.json();
        setUser({
          email: data.email || data.user_id || '',
          name: data.name || data.display_name || '',
          picture: data.picture || '',
          personalization: data.personalization || null,
          calendar_synced: !!data.google_calendar_tokens || !!data.calendar_synced,
        });
        setLoading(false);
        return;
      }
    } catch {}
    setUser({
      email: '',
      name: 'Nuo User',
      picture: '',
      personalization: null,
      calendar_synced: false,
    });
    setLoading(false);
  };

  const handleEdit = () => {
    Alert.alert('Coming Soon', 'Profile editing will be available in a future update.');
  };

  const handleCalendarSync = async () => {
    try {
      const resp = await apiFetch(`/api/calendar/auth?source=profile`);
      if (!resp.ok) throw new Error();
      const data = await resp.json();
      if (data.auth_url) {
        if (Platform.OS === 'web') { window.open(data.auth_url, '_blank'); }
        else { Linking.openURL(data.auth_url); }
      }
    } catch {
      Alert.alert('Error', 'Failed to start calendar sync.');
    }
  };

  const handleNotifications = () => {
    Alert.alert('Coming Soon', 'Push notifications will be available in a future update.');
  };

  const handlePrivacy = () => {
    Alert.alert('Coming Soon', 'Privacy settings will be available in a future update.');
  };

  const handleResetOnboarding = () => {
    Alert.alert(
      'Reset Onboarding',
      'This will restart the onboarding flow. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('onboarding_complete');
            router.replace('/splash1');
          },
        },
      ]
    );
  };

  const handleHelp = () => {
    router.push('/debug');
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            await AsyncStorage.multiRemove(['onboarding_complete', 'userEmail', 'userName']);
            router.replace('/auth');
          },
        },
      ]
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const personalization = user?.personalization;

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingWrap, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top || (Platform.OS === 'android' ? StatusBar.currentHeight : 0) }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} testID="profile-back-btn">
          <Feather name="arrow-left" size={22} color={COLORS.textHeading} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={handleEdit} style={styles.headerBtn} testID="profile-edit-btn">
          <Feather name="edit-2" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          {user?.picture ? (
            <View style={styles.avatarWrap}>
              <View style={styles.avatarImg}>
                <Text style={styles.avatarInitials}>{getInitials(user.name || 'U')}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.avatarWrap}>
              <View style={styles.avatarImg}>
                <Text style={styles.avatarInitials}>{getInitials(user?.name || 'U')}</Text>
              </View>
            </View>
          )}
          <Text style={styles.profileName}>{user?.name || 'Nuo User'}</Text>
          <Text style={styles.profileEmail}>{user?.email || 'Not signed in'}</Text>
        </View>

        {/* Personal Information */}
        {personalization && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <View style={styles.sectionCard}>
              <InfoRow icon="user" label="Name" value={personalization.name || user?.name || '-'} />
              <InfoRow icon="calendar" label="Age" value={personalization.age || '-'} />
              <InfoRow icon="heart" label="Gender" value={personalization.gender || '-'} />
              <InfoRow icon="briefcase" label="Profession" value={personalization.profession || '-'} />
              <InfoRow icon="award" label="Role" value={personalization.role || '-'} last />
            </View>
          </View>
        )}

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.sectionCard}>
            <SettingsRow
              icon="calendar"
              label="Calendar Sync"
              value={user?.calendar_synced ? 'Connected' : 'Not Connected'}
              valueColor={user?.calendar_synced ? COLORS.success : COLORS.danger}
              onPress={handleCalendarSync}
            />
            <SettingsRow
              icon="bell"
              label="Notifications"
              value="Enabled"
              onPress={handleNotifications}
            />
            <SettingsRow
              icon="refresh-cw"
              label="Reset Onboarding"
              value=""
              onPress={handleResetOnboarding}
            />
            <SettingsRow
              icon="shield"
              label="Privacy"
              value=""
              onPress={handlePrivacy}
            />
            <SettingsRow
              icon="help-circle"
              label="Help & Support"
              value=""
              onPress={handleHelp}
              last
            />
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} testID="logout-btn">
          <Feather name="log-out" size={18} color={COLORS.danger} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Nuo v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value, last }: { icon: string; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <View style={styles.infoLeft}>
        <View style={styles.infoIconWrap}>
          <Feather name={icon as any} size={16} color={COLORS.primary} />
        </View>
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function SettingsRow({ icon, label, value, valueColor, onPress, last }: {
  icon: string; label: string; value: string; valueColor?: string; onPress: () => void; last?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.settingsRow, !last && styles.infoRowBorder]} onPress={onPress} testID={`settings-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <View style={styles.infoLeft}>
        <View style={styles.infoIconWrap}>
          <Feather name={icon as any} size={16} color={COLORS.primary} />
        </View>
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <View style={styles.settingsRight}>
        {value ? <Text style={[styles.settingsValue, valueColor ? { color: valueColor } : {}]}>{value}</Text> : null}
        <Feather name="chevron-right" size={18} color={COLORS.textDim} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingWrap: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    color: COLORS.textHeading,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  // Profile Card
  profileCard: {
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatarWrap: { marginBottom: 14 },
  avatarImg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 28,
    fontFamily: 'Poppins_700Bold',
    color: '#FFF',
  },
  profileName: {
    fontSize: 22,
    fontFamily: 'Poppins_700Bold',
    color: COLORS.textHeading,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: COLORS.textBody,
  },

  // Section
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: COLORS.textBody,
    marginBottom: 10,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // Info Row
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: COLORS.textHeading,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: COLORS.textBody,
    maxWidth: 160,
    textAlign: 'right',
  },

  // Settings Row
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  settingsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingsValue: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: COLORS.textBody,
  },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.dangerLight,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: COLORS.danger,
  },

  versionText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: COLORS.textDim,
    textAlign: 'center',
    marginTop: 8,
  },
});
