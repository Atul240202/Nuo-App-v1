# Nuos Wellness App - PRD

## Overview
A React Native (Expo) home screen UI for a wellness/recovery app called "Nuos". This is a UI-only implementation with hardcoded placeholder data and no backend logic.

## Screens
### Home Screen (index.tsx)
1. **Header** – "Hi, Sarah 👋" greeting, Bluetooth + Help icon buttons
2. **Calendar Pill** – Rounded pill button with calendar icon
3. **Recovery Index Scorecard** – Circular SVG progress ring (78/100), gradient purple, "+5% this week" success badge, dot indicators
4. **Auto Recoveries Today** – 3 recovery cards (Sleep Mode, Focus Soundscape, Breathing Reminder) with icons and time badges
5. **How We Know You** – 3 metric cards (Heart Rate 68 bpm, Sleep 7.2 hrs, Stress Level Low)
6. **Today's Recovery Plan** – 3 task cards with alarm/calendar/check action buttons, "0/3 done" badge
7. **Vent with Nuo** – Purple gradient CTA banner with mic icon
8. **Bottom Tab Bar** – 5 tabs (Home, My Favs, Mic FAB center, My Progress, You)

## Tech Stack
- **Frontend**: React Native (Expo SDK 54), expo-router
- **Fonts**: @expo-google-fonts/poppins (headings), @expo-google-fonts/inter (body)
- **Gradients**: expo-linear-gradient
- **SVG**: react-native-svg (circular progress ring)
- **Icons**: @expo/vector-icons (Feather, Ionicons, MaterialCommunityIcons)

## Theme
- Background: #F7F0F5 (soft pink)
- Primary: #7F00FF (purple)
- Cards: #FFFFFF with subtle purple shadows
- Text: #1A1523 (dark), #6E6A7C (muted)
