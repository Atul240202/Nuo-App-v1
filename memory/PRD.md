# Nuos Wellness App - PRD

## Overview
A React Native (Expo) wellness/recovery app called "Nuos" with animated splash screens, onboarding flow, OAuth sign-in, and a full home screen. UI-only implementation with hardcoded placeholder data.

## Navigation Flow
`/ (Splash1)` → auto 3.5s → `/splash2` → auto 3.8s → `/onboarding` → "Get Started" → `/google-oauth` → sign in → `/home`

## Screens

### 1. SplashScreen1 (index.tsx - /)
- Animated background color transition (#EDE0EA → #F7F0F5)
- Gradient logo (purple circle with wave SVG)
- Staggered text animations: "Built for high performers", "who need to recover fast", italic subtitle
- Auto-navigates to /splash2 after 3500ms

### 2. SplashScreen2 (splash2.tsx - /splash2)
- Animated SVG ring stroke drawing (1200ms)
- Pulsing glow effect (looping opacity)
- "Without stopping" title with slide-up animation
- Skip button → /onboarding
- Auto-navigates to /onboarding after 3800ms

### 3. OnboardingScreen (onboarding.tsx - /onboarding)
- 3 state-based slides with fade transitions
- Slide 1: ⚡ Track your recovery (purple bg)
- Slide 2: 🎯 Stay on your goals (pink bg)
- Slide 3: 🚀 Perform without limits (light bg)
- Animated dot indicators, Next/Get Started button
- Skip jumps to last slide

### 4. GoogleOAuthScreen (google-oauth.tsx - /google-oauth)
- Wave logo, "Welcome back" title
- Google sign-in button (4-color G SVG icon)
- Apple sign-in button (dark bg, Apple icon)
- Loading states with ActivityIndicator (MOCKED 1500ms)
- Terms & Privacy links with Alert
- Navigates to /home on sign-in

### 5. HomeScreen (home.tsx - /home)
- Header (Hi, Sarah 👋), Bluetooth/Help icons
- Calendar pill, Recovery Index scorecard (78/100 SVG ring)
- Auto Recoveries list, How We Know You metrics
- Today's Recovery Plan tasks, Vent with Nuo CTA
- Bottom tab bar with floating mic FAB

## Tech Stack
- **Frontend**: React Native (Expo SDK 54), expo-router, Animated API
- **Fonts**: @expo-google-fonts/poppins (headings), @expo-google-fonts/inter (body)
- **Gradients**: expo-linear-gradient
- **SVG**: react-native-svg (circular progress, Google G logo, wave logo)
- **Icons**: @expo/vector-icons (Feather, Ionicons, MaterialCommunityIcons)

## Theme
- Background: #F7F0F5, Primary: #7F00FF, Cards: #FFFFFF
- Text: #2A1F3D (heading), #6E6A7C (body), #7A7085 (muted)
