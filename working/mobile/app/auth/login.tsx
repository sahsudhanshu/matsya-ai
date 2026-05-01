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
        <View className="items-center pt-8 pb-6">
          <View
            className="mb-2.5 h-16 w-16 items-center justify-center rounded-2xl bg-[#1e40af]"
            style={{
              shadowColor: COLORS.primary,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.35,
              shadowRadius: 12,
              elevation: 6,
            }}
          >
            <Ionicons name="fish" size={30} color={COLORS.primaryLight} />
          </View>
          <Text className="text-[26px] font-extrabold tracking-[-0.5px] text-[#f8fafc]">
            Matsya AI
          </Text>
          <Text className="mt-1 text-[12px] font-medium text-[#94a3b8]">
            AI for Bharat Fishermen
          </Text>
          <View className="mt-2 rounded-full bg-[#d9770620] px-2.5 py-[3px]">
            <Text className="text-[10px] font-semibold text-[#f59e0b]">
              AWS AI for Bharat Challenge
            </Text>
          </View>
        </View>

        {/* Card */}
        <View className="mb-6 rounded-[20px] border border-[#334155] bg-[#1e293b] p-6">
          <Text className="mb-1 text-[20px] font-bold text-[#f8fafc]">
            Welcome Back
          </Text>
          <Text className="mb-6 text-[12px] text-[#94a3b8]">
            Sign in to continue to your dashboard
          </Text>

          <View className="mb-2.5">
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

          <View className="mb-2.5">
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
            className="mt-2"
          />

          <View className="mt-4 flex-row justify-center">
            <Text className="text-[12px] text-[#94a3b8]">
              Don't have an account? 
            </Text>
            <TouchableOpacity onPress={() => router.push("/auth/register")}>
              <Text className="text-[12px] font-semibold text-[#3b82f6]">
                Register
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Feature highlights */}
        <View className="flex-row justify-around">
          {[
            { icon: "fish-outline" as const, label: "AI Fish ID" },
            { icon: "map-outline" as const, label: "Ocean Map" },
            { icon: "chatbubbles-outline" as const, label: "AI Assistant" },
            { icon: "bar-chart-outline" as const, label: "Analytics" },
          ].map((f) => (
            <View key={f.label} className="items-center gap-1">
              <Ionicons name={f.icon} size={18} color={COLORS.primaryLight} />
              <Text className="text-[10px] font-medium text-[#64748b]">
                {f.label}
              </Text>
            </View>
          ))}
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
