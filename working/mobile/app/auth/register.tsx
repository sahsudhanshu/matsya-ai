import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: SPACING.xl,
          paddingBottom: SPACING["4xl"],
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
      >
        {/* Header */}
        <View className="pt-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="self-start py-2"
          >
            <Text className="text-[13px] font-semibold text-[#3b82f6]">
              ← Back
            </Text>
          </TouchableOpacity>
        </View>

        {/* Hero */}
        <View className="items-center py-6">
          <View
            className="mb-2.5 h-[54px] w-[54px] items-center justify-center rounded-[14px] bg-[#047857]"
            style={{
              shadowColor: COLORS.secondary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 10,
              elevation: 5,
            }}
          >
            <Ionicons
              name="water-outline"
              size={28}
              color={COLORS.primaryLight}
            />
          </View>
          <Text className="text-center text-[20px] font-bold text-[#f8fafc]">
            Create Your Account
          </Text>
          <Text className="mt-1 px-6 text-center text-[12px] text-[#94a3b8]">
            Join thousands of fishermen modernizing their operations
          </Text>
        </View>

        {/* Form Card */}
        <View className="mb-6 rounded-[20px] border border-[#334155] bg-[#1e293b] p-6">
          <View className="mb-2.5">
            <Input
              label="Full Name *"
              placeholder="Rajan Kumar"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>
          <View className="mb-2.5">
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
          <View className="mb-2.5">
            <Input
              label="Phone Number (optional)"
              placeholder="+91 9876543210"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <Text className="mt-1 ml-1 text-[10px] text-[#94a3b8]">
              Include country code (e.g., +91 for India)
            </Text>
          </View>
          <View className="mb-2.5">
            <Input
              label="Password *"
              placeholder="Create a secure password"
              value={password}
              onChangeText={handlePasswordChange}
              secureTextEntry
              showPasswordToggle
            />
            {password.length > 0 && (
              <View className="mt-2.5 gap-1.5 rounded-xl bg-[#334155] p-4">
                <Text className="mb-1 text-[10px] font-bold text-[#e2e8f0]">
                  Password Requirements:
                </Text>
                <View className="flex-row items-center gap-2.5">
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
                  <Text className={passwordRequirements.minLength ? "text-[10px] text-[#10b981] font-semibold" : "text-[10px] text-[#94a3b8]"}>
                    At least 8 characters
                  </Text>
                </View>
                <View className="flex-row items-center gap-2.5">
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
                  <Text className={passwordRequirements.hasUppercase ? "text-[10px] text-[#10b981] font-semibold" : "text-[10px] text-[#94a3b8]"}>
                    One uppercase letter (A-Z)
                  </Text>
                </View>
                <View className="flex-row items-center gap-2.5">
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
                  <Text className={passwordRequirements.hasLowercase ? "text-[10px] text-[#10b981] font-semibold" : "text-[10px] text-[#94a3b8]"}>
                    One lowercase letter (a-z)
                  </Text>
                </View>
                <View className="flex-row items-center gap-2.5">
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
                  <Text className={passwordRequirements.hasNumber ? "text-[10px] text-[#10b981] font-semibold" : "text-[10px] text-[#94a3b8]"}>
                    One number (0-9)
                  </Text>
                </View>
                <View className="flex-row items-center gap-2.5">
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
                  <Text className={passwordRequirements.hasSpecial ? "text-[10px] text-[#10b981] font-semibold" : "text-[10px] text-[#94a3b8]"}>
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
            className="mt-2"
          />

          <View className="mt-4 flex-row justify-center">
            <Text className="text-[12px] text-[#94a3b8]">
              Already have an account? 
            </Text>
            <TouchableOpacity onPress={() => router.push("/auth/login")}>
              <Text className="text-[12px] font-bold text-[#3b82f6]">
                Sign In
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Benefits */}
        <View className="gap-1 rounded-[16px] border border-[#334155] bg-[#1e293b] p-4">
          <Text className="mb-1 text-[13px] font-semibold text-[#f8fafc]">
            Why Matsya AI?
          </Text>
          {[
            "Instant AI fish species identification",
            "Accurate weight & market price estimates",
            "Real-time ocean data & fishing zones",
            "24/7 AI fisherman assistant",
            "Catch history & earnings analytics",
          ].map((b) => (
            <View key={b} className="mb-1.5 flex-row items-center gap-2">
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={COLORS.success}
              />
              <Text className="text-[12px] leading-[18px] text-[#e2e8f0]">
                {b}
              </Text>
            </View>
          ))}
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
