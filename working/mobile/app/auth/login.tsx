import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing Fields", "Please enter your email and password.");
      return;
    }
    const normalizedEmail = email.trim();
    const normalizedPassword = password.trim();
    setLoading(true);
    try {
      await login(normalizedEmail, normalizedPassword);
      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert("Login Failed", e.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAwareScrollView
        style={styles.keyboardView}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
      >
        {/* Header */}
        <View style={styles.hero}>
          <View style={styles.logoContainer}>
            <Ionicons name="fish" size={30} color={COLORS.primaryLight} />
          </View>
          <Text style={styles.appName}>OceanAI</Text>
          <Text style={styles.tagline}>AI for Bharat Fishermen</Text>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>
              AWS AI for Bharat Challenge
            </Text>
          </View>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome Back</Text>
          <Text style={styles.cardSubtitle}>
            Sign in to continue to your dashboard
          </Text>

          <View style={styles.formGroup}>
            <Input
              label="Email Address"
              placeholder="rajan@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.formGroup}>
            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              showPasswordToggle
            />
          </View>

          <Button
            label={loading ? "Signing in..." : "Sign In"}
            onPress={handleLogin}
            loading={loading}
            fullWidth
            size="lg"
            style={styles.loginBtn}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push("/auth/register")}>
              <Text style={styles.footerLink}>Register</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Feature highlights */}
        <View style={styles.features}>
          {[
            { icon: "fish-outline" as const, label: "AI Fish ID" },
            { icon: "map-outline" as const, label: "Ocean Map" },
            { icon: "chatbubbles-outline" as const, label: "AI Assistant" },
            { icon: "bar-chart-outline" as const, label: "Analytics" },
          ].map((f) => (
            <View key={f.label} style={styles.featureItem}>
              <Ionicons name={f.icon} size={18} color={COLORS.primaryLight} />
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgDark },
  keyboardView: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING["4xl"],
  },

  hero: {
    alignItems: "center",
    paddingTop: SPACING["2xl"],
    paddingBottom: SPACING.xl,
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },

  appName: {
    fontSize: FONTS.sizes["3xl"],
    fontWeight: FONTS.weights.extrabold,
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    fontWeight: FONTS.weights.medium,
  },
  heroBadge: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.accent + "20",
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  heroBadgeText: {
    color: COLORS.accentLight,
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semibold,
  },

  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  cardTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  cardSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.lg,
  },
  formGroup: { marginBottom: SPACING.sm },

  loginBtn: { marginTop: SPACING.sm },

  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: SPACING.md,
  },
  footerText: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm },
  footerLink: {
    color: COLORS.primaryLight,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
  },

  features: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  featureItem: { alignItems: "center", gap: SPACING.xs },

  featureLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSubtle,
    fontWeight: FONTS.weights.medium,
  },
});
