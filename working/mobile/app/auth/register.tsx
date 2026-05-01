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

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Password requirements state
  const [passwordRequirements, setPasswordRequirements] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecial: false,
  });

  // Validate password requirements in real-time
  const validatePassword = (pwd: string) => {
    setPasswordRequirements({
      minLength: pwd.length >= 8,
      hasUppercase: /[A-Z]/.test(pwd),
      hasLowercase: /[a-z]/.test(pwd),
      hasNumber: /[0-9]/.test(pwd),
      hasSpecial: /[^A-Za-z0-9]/.test(pwd),
    });
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    validatePassword(text);
  };

  const isPasswordValid = () => {
    return Object.values(passwordRequirements).every((req) => req === true);
  };

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert("Missing Fields", "Please fill in all required fields.");
      return;
    }

    if (!isPasswordValid()) {
      Alert.alert(
        "Invalid Password",
        "Please ensure your password meets all requirements.",
      );
      return;
    }

    // Validate phone number format if provided
    if (phone.trim() && !phone.trim().startsWith("+")) {
      Alert.alert(
        "Invalid Phone Number",
        "Phone number must include country code (e.g., +91 for India).\n\nExample: +91 9876543210",
      );
      return;
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();
    const normalizedPhone = phone.trim();

    setLoading(true);
    try {
      await register(
        normalizedName,
        normalizedEmail,
        normalizedPassword,
        normalizedPhone,
      );
      Alert.alert(
        "Account Created",
        "Your account has been created successfully. Please sign in.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/auth/login"),
          },
        ],
      );
    } catch (e: any) {
      console.error("Registration error:", e);
      Alert.alert("Registration Failed", e.message || "Please try again.");
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
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.logoContainer}>
            <Ionicons
              name="water-outline"
              size={28}
              color={COLORS.primaryLight}
            />
          </View>
          <Text style={styles.title}>Create Your Account</Text>
          <Text style={styles.subtitle}>
            Join thousands of fishermen modernizing their operations
          </Text>
        </View>

        {/* Form Card */}
        <View style={styles.card}>
          <View style={styles.formGroup}>
            <Input
              label="Full Name *"
              placeholder="Rajan Kumar"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>
          <View style={styles.formGroup}>
            <Input
              label="Email Address *"
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
              label="Phone Number (optional)"
              placeholder="+91 9876543210"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <Text style={styles.helperText}>
              Include country code (e.g., +91 for India)
            </Text>
          </View>
          <View style={styles.formGroup}>
            <Input
              label="Password *"
              placeholder="Create a secure password"
              value={password}
              onChangeText={handlePasswordChange}
              secureTextEntry
              showPasswordToggle
            />
            {password.length > 0 && (
              <View style={styles.passwordRequirements}>
                <Text style={styles.requirementsTitle}>
                  Password Requirements:
                </Text>
                <View style={styles.requirementItem}>
                  <Ionicons
                    name={
                      passwordRequirements.minLength
                        ? "checkmark-circle"
                        : "close-circle"
                    }
                    size={16}
                    color={
                      passwordRequirements.minLength
                        ? COLORS.success
                        : COLORS.textMuted
                    }
                  />
                  <Text
                    style={[
                      styles.requirementText,
                      passwordRequirements.minLength && styles.requirementMet,
                    ]}
                  >
                    At least 8 characters
                  </Text>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons
                    name={
                      passwordRequirements.hasUppercase
                        ? "checkmark-circle"
                        : "close-circle"
                    }
                    size={16}
                    color={
                      passwordRequirements.hasUppercase
                        ? COLORS.success
                        : COLORS.textMuted
                    }
                  />
                  <Text
                    style={[
                      styles.requirementText,
                      passwordRequirements.hasUppercase &&
                        styles.requirementMet,
                    ]}
                  >
                    One uppercase letter (A-Z)
                  </Text>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons
                    name={
                      passwordRequirements.hasLowercase
                        ? "checkmark-circle"
                        : "close-circle"
                    }
                    size={16}
                    color={
                      passwordRequirements.hasLowercase
                        ? COLORS.success
                        : COLORS.textMuted
                    }
                  />
                  <Text
                    style={[
                      styles.requirementText,
                      passwordRequirements.hasLowercase &&
                        styles.requirementMet,
                    ]}
                  >
                    One lowercase letter (a-z)
                  </Text>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons
                    name={
                      passwordRequirements.hasNumber
                        ? "checkmark-circle"
                        : "close-circle"
                    }
                    size={16}
                    color={
                      passwordRequirements.hasNumber
                        ? COLORS.success
                        : COLORS.textMuted
                    }
                  />
                  <Text
                    style={[
                      styles.requirementText,
                      passwordRequirements.hasNumber && styles.requirementMet,
                    ]}
                  >
                    One number (0-9)
                  </Text>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons
                    name={
                      passwordRequirements.hasSpecial
                        ? "checkmark-circle"
                        : "close-circle"
                    }
                    size={16}
                    color={
                      passwordRequirements.hasSpecial
                        ? COLORS.success
                        : COLORS.textMuted
                    }
                  />
                  <Text
                    style={[
                      styles.requirementText,
                      passwordRequirements.hasSpecial && styles.requirementMet,
                    ]}
                  >
                    One special character (!@#$%^&*)
                  </Text>
                </View>
              </View>
            )}
          </View>

          <Button
            label={loading ? "Creating Account..." : "Create Account"}
            onPress={handleRegister}
            loading={loading}
            fullWidth
            size="lg"
            style={styles.registerBtn}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push("/auth/login")}>
              <Text style={styles.footerLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Benefits */}
        <View style={styles.benefits}>
          <Text style={styles.benefitsTitle}>Why Matsya AI?</Text>
          {[
            "Instant AI fish species identification",
            "Accurate weight & market price estimates",
            "Real-time ocean data & fishing zones",
            "24/7 AI fisherman assistant",
            "Catch history & earnings analytics",
          ].map((b) => (
            <View
              key={b}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={COLORS.success}
              />
              <Text style={styles.benefitItem}>{b}</Text>
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
  header: { paddingTop: SPACING.md },
  backBtn: { alignSelf: "flex-start", paddingVertical: SPACING.sm },
  backBtnText: {
    color: COLORS.primaryLight,
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semibold,
  },

  hero: {
    alignItems: "center",
    paddingVertical: SPACING.lg,
  },
  logoContainer: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: COLORS.secondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },

  title: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.lg,
  },

  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  formGroup: { marginBottom: SPACING.sm },
  helperText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  passwordRequirements: {
    marginTop: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.md,
    gap: SPACING.xs,
  },
  requirementsTitle: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  requirementItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  requirementText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
  },
  requirementMet: {
    color: COLORS.success,
    fontWeight: FONTS.weights.semibold,
  },
  registerBtn: { marginTop: SPACING.sm },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: SPACING.lg,
  },
  footerText: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm },
  footerLink: {
    color: COLORS.primaryLight,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },

  benefits: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  benefitsTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  benefitItem: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});
