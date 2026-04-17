import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { Sora_300Light, Sora_400Regular, Sora_500Medium } from '@expo-google-fonts/sora';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from '../contexts/AuthContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Sora_300Light,
    Sora_400Regular,
    Sora_500Medium,
    SpaceMono_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#7F00FF" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="splash1" />
        <Stack.Screen name="splash2" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="auth-callback" />
        <Stack.Screen name="intro" />
        <Stack.Screen name="personalization" />
        <Stack.Screen name="transition" />
        <Stack.Screen name="voice" />
        <Stack.Screen name="debug" />
        <Stack.Screen name="paywall" />
        <Stack.Screen name="home" />
        <Stack.Screen name="audio-library" />
        <Stack.Screen name="calendar" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="progress" />
      </Stack>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0A14',
  },
});
