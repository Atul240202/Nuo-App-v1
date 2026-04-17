import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { apiFetch } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const RAZORPAY_KEY = process.env.EXPO_PUBLIC_RAZORPAY_KEY;

const C = {
  bg: '#040c18',
  teal: '#00d4aa',
  violet: '#8b5cf6',
  textPrimary: 'rgba(255,255,255,0.88)',
  textSecondary: 'rgba(255,255,255,0.35)',
  surface: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.10)',
};

interface Plan {
  id: string;
  label: string;
  price: number;
  amount_paise: number;
  days: number;
}

export default function PaywallScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<string>('1_week');
  const [loading, setLoading] = useState(false);
  const [sessionsUsed, setSessionsUsed] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [plansResp, statusResp] = await Promise.all([
          fetch(`${BACKEND_URL}/api/payment/plans`),
          apiFetch(`/api/session/status`),
        ]);
        if (plansResp.ok) {
          const data = await plansResp.json();
          setPlans(data.plans || []);
        }
        if (statusResp.ok) {
          const data = await statusResp.json();
          setSessionsUsed(data.sessions_used || 0);
        }
      } catch {}
    })();
  }, []);

  const handlePurchase = async () => {
    const plan = plans.find(p => p.id === selected);
    if (!plan) return;
    setLoading(true);

    try {
      // Create order on backend
      const orderResp = await apiFetch(`/api/payment/create-order`, {
        method: 'POST',
        jsonBody: { plan_id: selected },
      });
      if (!orderResp.ok) { setLoading(false); return; }
      const orderData = await orderResp.json();

      if (Platform.OS === 'web') {
        // Load Razorpay script if not loaded
        if (!(window as any).Razorpay) {
          await new Promise<void>((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve();
            document.head.appendChild(script);
          });
        }

        const options = {
          key: RAZORPAY_KEY,
          amount: orderData.amount,
          currency: 'INR',
          name: 'Nuo',
          description: plan.label,
          order_id: orderData.order_id,
          handler: async (response: any) => {
            // Verify payment
            try {
              const verifyResp = await apiFetch(`/api/payment/verify`, {
                method: 'POST',
                jsonBody: {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                },
              });
              if (verifyResp.ok) {
                router.replace('/voice');
              }
            } catch {}
            setLoading(false);
          },
          modal: { ondismiss: () => setLoading(false) },
          prefill: { email: user?.email || '' },
          theme: { color: '#8b5cf6' },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      }
    } catch {
      setLoading(false);
    }
  };

  const bestValue = '1_week';

  return (
    <View style={styles.container} testID="paywall-screen">
      <StatusBar barStyle="light-content" />

      <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} testID="paywall-close">
        <Feather name="x" size={22} color={C.textSecondary} />
      </TouchableOpacity>

      <View style={styles.header}>
        <Ionicons name="mic-outline" size={40} color={C.violet} />
        <Text style={styles.title}>You've used your 3 free sessions today</Text>
        <Text style={styles.subtitle}>Unlock unlimited voice sessions with Nuo</Text>
      </View>

      <View style={styles.usageBar}>
        <View style={styles.usageDots}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[styles.usageDot, i < sessionsUsed && styles.usageDotUsed]} />
          ))}
        </View>
        <Text style={styles.usageText}>{sessionsUsed}/3 used today</Text>
      </View>

      {/* Plans */}
      <View style={styles.plansContainer}>
        {plans.map((plan) => (
          <TouchableOpacity
            key={plan.id}
            style={[styles.planCard, selected === plan.id && styles.planCardSelected]}
            onPress={() => setSelected(plan.id)}
            testID={`plan-${plan.id}`}
          >
            {plan.id === bestValue && (
              <View style={styles.bestBadge}><Text style={styles.bestBadgeText}>Best Value</Text></View>
            )}
            <Text style={styles.planDays}>
              {plan.days === 1 ? '1 Day' : plan.days === 7 ? '1 Week' : '1 Month'}
            </Text>
            <Text style={[styles.planPrice, selected === plan.id && styles.planPriceSelected]}>₹{plan.price}</Text>
            {plan.days > 1 && (
              <Text style={styles.planPer}>₹{Math.round(plan.price / plan.days)}/day</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Features */}
      <View style={styles.features}>
        {['Unlimited voice sessions', 'Full voice analysis & insights', 'Personalized audio interventions', 'Calendar-aware recovery planning'].map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <Feather name="check" size={14} color={C.teal} />
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>

      {/* CTA */}
      <TouchableOpacity onPress={handlePurchase} disabled={loading} activeOpacity={0.9} testID="purchase-btn">
        <LinearGradient colors={['#8b5cf6', '#6d28d9']} style={styles.ctaBtn}>
          {loading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.ctaText}>
              Continue · ₹{plans.find(p => p.id === selected)?.price || ''}
            </Text>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <Text style={styles.footerText}>Secure payment via Razorpay</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 24, paddingTop: 60 },
  closeBtn: { position: 'absolute', top: 56, right: 20, zIndex: 10, padding: 8 },
  header: { alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: C.textPrimary, textAlign: 'center', marginTop: 16 },
  subtitle: { fontSize: 14, fontFamily: 'Sora_400Regular', color: C.textSecondary, textAlign: 'center', marginTop: 6 },

  usageBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 28 },
  usageDots: { flexDirection: 'row', gap: 6 },
  usageDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: C.border },
  usageDotUsed: { backgroundColor: C.violet, borderColor: C.violet },
  usageText: { fontSize: 12, fontFamily: 'SpaceMono_400Regular', color: C.textSecondary },

  plansContainer: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  planCard: {
    flex: 1, backgroundColor: C.surface, borderRadius: 16, paddingVertical: 18, paddingHorizontal: 12,
    alignItems: 'center', borderWidth: 1.5, borderColor: C.border,
  },
  planCardSelected: { borderColor: C.violet, backgroundColor: 'rgba(139,92,246,0.08)' },
  bestBadge: { position: 'absolute', top: -9, backgroundColor: C.teal, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  bestBadgeText: { fontSize: 9, fontFamily: 'SpaceMono_400Regular', color: '#000', letterSpacing: 0.5 },
  planDays: { fontSize: 12, fontFamily: 'Sora_500Medium', color: C.textSecondary, marginBottom: 6 },
  planPrice: { fontSize: 24, fontFamily: 'SpaceMono_400Regular', color: C.textPrimary },
  planPriceSelected: { color: C.violet },
  planPer: { fontSize: 10, fontFamily: 'SpaceMono_400Regular', color: C.textSecondary, marginTop: 4 },

  features: { marginBottom: 28, gap: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { fontSize: 14, fontFamily: 'Sora_400Regular', color: C.textPrimary },

  ctaBtn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  ctaText: { fontSize: 16, fontFamily: 'Sora_500Medium', color: '#FFF' },
  footerText: { fontSize: 12, fontFamily: 'Sora_300Light', color: C.textSecondary, textAlign: 'center' },
});
