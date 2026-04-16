# Nuo - Automatic Nervous Regulation Layer - PRD

## Overview
Premium mobile onboarding + voice interaction flow for Nuo, an "Automatic Nervous Regulation Layer" that autonomously detects and regulates nervous system dysregulation using binaural audio interventions.

## Navigation Flow
`/ (Logo)` → 4.5s → `/splash1` → 4s → `/splash2` → 4s → `/auth` → Google OAuth → `/auth-callback` → `/intro` → `/personalization` (6 steps) → `/transition` → `/voice` → `/home`

## Screens

### Dark Theme (Logo + Splashes + Voice)
- **Background**: Base64-embedded gradient image (coral→purple→blue) with breathing pulse animation
- **Overlay**: Semi-transparent dark for readability

1. **Logo Screen** (/) - Nuo logo, "Automatic Nervous Regulation Layer", "Works even when you do nothing"
2. **Splash1** (/splash1) - "Built for high performers" / "who need to recover fast" / italic subtitle
3. **Splash2** (/splash2) - Animated SVG ring, "Without stopping", "We handle the recovery while you keep going"
4. **Voice Screen** (/voice) - Siri-like pulsating orb, real microphone recording, idle/listening/processing states

### Light Theme (Auth + Personalization)
5. **Auth** (/auth) - Real Emergent-managed Google OAuth, "Continue to Nuo"
6. **Auth Callback** (/auth-callback) - Processes session_id, creates/updates user in DB
7. **Intro** (/intro) - "Meet Nuo", pulsating dark blob, "Get Started" CTA
8. **Personalization** (/personalization) - 6-step flow: Name, Age, Gender (with "Calibrating..." micro-feedback), Profession, Role, Calendar Sync
9. **Transition** (/transition) - "You're all set" → auto-nav to voice

### Home
10. **Home** (/home) - Full wellness dashboard

## Tech Stack
- **Frontend**: React Native (Expo SDK 54), expo-router, Animated API
- **Backend**: FastAPI + MongoDB
- **Auth**: Emergent-managed Google OAuth
- **Audio**: expo-av for mic recording
- **Fonts**: Poppins (headings), Inter (body)
- **Gradients**: expo-linear-gradient
- **SVG**: react-native-svg

## Integrations
- **Emergent Google OAuth** - Real authentication flow
- **Microphone** - Real mic permissions + audio recording via expo-av
- **Calendar** - UI built, backend endpoint ready (needs Google Calendar API credentials for full integration)
- **Voice Upload** - Backend endpoint receives recording metadata (MOCKED processing)
