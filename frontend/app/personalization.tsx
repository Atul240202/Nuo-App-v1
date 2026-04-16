import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Animated,
  KeyboardAvoidingView, Platform, StatusBar, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { LIGHT } from '../constants/theme';

const PROFESSIONS = ['Technology', 'Finance', 'Healthcare', 'Education', 'Creative Arts', 'Sports', 'Consulting', 'Legal', 'Other'];
const ROLES = ['Founder / CEO', 'Executive', 'Manager', 'Individual Contributor', 'Freelancer', 'Student', 'Athlete', 'Other'];
const GENDERS = ['Male', 'Female', 'Prefer not to say'];

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function PersonalizationScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [profession, setProfession] = useState('');
  const [role, setRole] = useState('');
  const [calibrating, setCalibrating] = useState(false);
  const [complete, setComplete] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const animateStep = (next: number) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setStep(next);
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const handleNext = async () => {
    if (step === 3) {
      setCalibrating(true);
      setTimeout(() => {
        setCalibrating(false);
        animateStep(4);
      }, 1800);
      return;
    }
    if (step < 6) {
      animateStep(step + 1);
    } else {
      // Save personalization
      try {
        await fetch(`${BACKEND_URL}/api/user/personalization`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name, age, gender, profession, role, calendar_synced: false }),
        });
      } catch {}
      setComplete(true);
      setTimeout(() => router.replace('/transition'), 2000);
    }
  };

  const handleCalendarSync = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/user/personalization`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, age, gender, profession, role, calendar_synced: true }),
      });
    } catch {}
    setComplete(true);
    setTimeout(() => router.replace('/transition'), 2000);
  };

  const canProceed = () => {
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return age.trim().length > 0;
    if (step === 3) return gender.length > 0;
    if (step === 4) return profession.length > 0;
    if (step === 5) return role.length > 0;
    return true;
  };

  if (calibrating) {
    return (
      <View style={styles.container} testID="calibrating-screen">
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color={LIGHT.accent} />
        <Text style={styles.calibrateText}>Calibrating your recovery model...</Text>
      </View>
    );
  }

  if (complete) {
    return (
      <View style={styles.container} testID="complete-screen">
        <StatusBar barStyle="dark-content" />
        <Text style={styles.completeText}>Nuo is now tuned to you</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      testID="personalization-screen"
    >
      <StatusBar barStyle="dark-content" />
      <Text style={styles.stepLabel}>Step {step} of 6</Text>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {step === 1 && (
          <View testID="step-name">
            <Text style={styles.question}>What should I call you?</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={LIGHT.textDim}
              testID="input-name"
            />
          </View>
        )}
        {step === 2 && (
          <View testID="step-age">
            <Text style={styles.question}>Your age helps me tune recovery patterns</Text>
            <TextInput
              style={styles.input}
              value={age}
              onChangeText={setAge}
              placeholder="Your age"
              placeholderTextColor={LIGHT.textDim}
              keyboardType="numeric"
              testID="input-age"
            />
          </View>
        )}
        {step === 3 && (
          <View testID="step-gender">
            <Text style={styles.question}>How do you identify?</Text>
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.optionBtn, gender === g && styles.optionBtnActive]}
                onPress={() => setGender(g)}
                testID={`gender-${g.toLowerCase().replace(/ /g, '-')}`}
              >
                <Text style={[styles.optionText, gender === g && styles.optionTextActive]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {step === 4 && (
          <ScrollView testID="step-profession" showsVerticalScrollIndicator={false}>
            <Text style={styles.question}>What's your profession?</Text>
            {PROFESSIONS.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.optionBtn, profession === p && styles.optionBtnActive]}
                onPress={() => setProfession(p)}
                testID={`profession-${p.toLowerCase().replace(/ /g, '-')}`}
              >
                <Text style={[styles.optionText, profession === p && styles.optionTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        {step === 5 && (
          <ScrollView testID="step-role" showsVerticalScrollIndicator={false}>
            <Text style={styles.question}>What's your role?</Text>
            {ROLES.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.optionBtn, role === r && styles.optionBtnActive]}
                onPress={() => setRole(r)}
                testID={`role-${r.toLowerCase().replace(/ /g, '-')}`}
              >
                <Text style={[styles.optionText, role === r && styles.optionTextActive]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        {step === 6 && (
          <View testID="step-calendar">
            <Text style={styles.question}>Let Nuo know your calendar</Text>
            <Text style={styles.calSub}>To find the best moments for recovery in your day</Text>
            <TouchableOpacity style={styles.syncBtn} onPress={handleCalendarSync} testID="sync-calendar-btn">
              <LinearGradient colors={['#7F00FF', '#5A00B8']} style={styles.syncGradient}>
                <Text style={styles.syncText}>Sync your calendar now</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleNext} testID="skip-calendar-btn">
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {step < 6 && (
        <TouchableOpacity
          style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
          onPress={handleNext}
          disabled={!canProceed()}
          testID="next-step-btn"
        >
          <LinearGradient
            colors={canProceed() ? ['#7F00FF', '#5A00B8'] : ['#D4D0DE', '#D4D0DE']}
            style={styles.nextGradient}
          >
            <Text style={[styles.nextText, !canProceed() && styles.nextTextDisabled]}>Continue</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LIGHT.bg, paddingHorizontal: 32, paddingTop: 80, alignItems: 'center' },
  stepLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: LIGHT.textDim, marginBottom: 32, letterSpacing: 1, textTransform: 'uppercase' },
  content: { flex: 1, width: '100%' },
  question: { fontSize: 24, fontFamily: 'Poppins_700Bold', color: LIGHT.text, marginBottom: 24 },
  input: {
    width: '100%', height: 56, borderRadius: 14, borderWidth: 1, borderColor: LIGHT.border,
    paddingHorizontal: 20, fontSize: 16, fontFamily: 'Inter_400Regular', color: LIGHT.text, backgroundColor: LIGHT.bgSoft,
  },
  optionBtn: {
    width: '100%', height: 52, borderRadius: 14, borderWidth: 1, borderColor: LIGHT.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12, backgroundColor: LIGHT.bgSoft,
  },
  optionBtnActive: { borderColor: '#7F00FF', backgroundColor: '#F0E5FF' },
  optionText: { fontSize: 16, fontFamily: 'Inter_500Medium', color: LIGHT.text },
  optionTextActive: { color: '#7F00FF' },
  nextBtn: { width: '100%', marginBottom: 40 },
  nextBtnDisabled: { opacity: 0.6 },
  nextGradient: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  nextText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF' },
  nextTextDisabled: { color: '#999' },
  calSub: { fontSize: 15, fontFamily: 'Inter_400Regular', color: LIGHT.textMuted, marginBottom: 32 },
  syncBtn: { width: '100%', marginBottom: 16 },
  syncGradient: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  syncText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF' },
  skipText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: LIGHT.textMuted, textAlign: 'center', paddingVertical: 12 },
  calibrateText: { fontSize: 16, fontFamily: 'Inter_500Medium', color: LIGHT.textMuted, marginTop: 16 },
  completeText: { fontSize: 22, fontFamily: 'Poppins_600SemiBold', color: LIGHT.text },
});
