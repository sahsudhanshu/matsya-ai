import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
  TouchableOpacity,
  Switch,
} from "react-native";
import { Stack, router } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import {
  getPublicProfile,
  updatePublicProfile,
  generatePublicSlug,
} from "../../lib/api-client";
import type { PublicProfile } from "../../lib/types";
import { COLORS } from "../../lib/constants";

export default function PublicProfileConfigScreen() {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingSlug, setGeneratingSlug] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [isPublic, setIsPublic] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [customSlug, setCustomSlug] = useState("");
  const [profileUrl, setProfileUrl] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPublicProfile();
      setProfile(data);
      setIsPublic(data.isPublic);
      setShowStats(data.showStats);
      setCustomSlug(data.slug || "");

      // Generate profile URL
      if (data.slug) {
        const baseUrl =
          process.env.EXPO_PUBLIC_WEB_URL || "https://oceanai.app";
        setProfileUrl(`${baseUrl}/profile/${data.slug}`);
      }
    } catch (err) {
      console.error("Error loading public profile:", err);
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const updatedProfile = await updatePublicProfile({
        isPublic,
        showStats,
      });

      setProfile(updatedProfile);
      Alert.alert("Success", "Public profile settings updated successfully");
    } catch (err) {
      console.error("Error updating public profile:", err);
      const message =
        err instanceof Error ? err.message : "Failed to update settings";
      setError(message);
      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateSlug = async () => {
    try {
      setGeneratingSlug(true);
      setError(null);

      const result = await generatePublicSlug();
      setCustomSlug(result.slug);
      setProfileUrl(result.url);

      Alert.alert("Success", "Profile link generated successfully");
    } catch (err) {
      console.error("Error generating slug:", err);
      const message =
        err instanceof Error ? err.message : "Failed to generate link";
      setError(message);
      Alert.alert("Error", message);
    } finally {
      setGeneratingSlug(false);
    }
  };

  const handleShare = async () => {
    if (!profileUrl) {
      Alert.alert("Error", "No profile link available");
      return;
    }

    try {
      await Share.share({
        message: `Check out my fishing profile on Matsya AI: ${profileUrl}`,
        url: profileUrl,
        title: "My Matsya AI Profile",
      });
    } catch (err) {
      console.error("Error sharing profile:", err);
      Alert.alert("Error", "Failed to share profile");
    }
  };

  const handlePreview = () => {
    router.push("/profile/public");
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
        <Stack.Screen
          options={{
            title: "Public Profile",
            headerBackTitle: "Back",
          }}
        />
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text className="mt-4 text-[12px] text-[#e2e8f0]">
            Loading profile settings...
          </Text>
        </View>
      </View>
    );
  }

  if (error && !profile) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
        <Stack.Screen
          options={{
            title: "Public Profile",
            headerBackTitle: "Back",
          }}
        />
        <View className="flex-1 items-center justify-center p-6">
          <Ionicons
            name="alert-circle-outline"
            size={64}
            color={COLORS.error}
          />
          <Text className="my-4 text-center text-[12px] text-[#ef4444]">
            {error}
          </Text>
          <Button label="Retry" onPress={loadProfile} variant="primary" />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <Stack.Screen
        options={{
          title: "Public Profile",
          headerBackTitle: "Back",
        }}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 24,
          paddingBottom: 48,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Card */}
        <Card
          className="mb-4"
          style={{
            backgroundColor: `${COLORS.info}15`,
            borderColor: `${COLORS.info}40`,
            borderWidth: 1,
          }}
        >
          <View className="flex-row items-start gap-2.5">
            <Ionicons name="information-circle" size={20} color={COLORS.info} />
            <Text className="flex-1 text-[12px] leading-5 text-[#3b82f6]">
              Share your fishing achievements with others by enabling your
              public profile
            </Text>
          </View>
        </Card>

        {/* Enable Public Profile */}
        <Card className="mb-4">
          <View className="flex-row items-center justify-between">
            <View className="mr-4 flex-1">
              <Text className="mb-1 text-[12px] font-semibold text-[#f8fafc]">
                Enable Public Profile
              </Text>
              <Text className="text-[12px] leading-[18px] text-[#94a3b8]">
                Make your profile visible to others
              </Text>
            </View>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
              thumbColor={isPublic ? COLORS.primary : COLORS.textMuted}
            />
          </View>
        </Card>

        {/* Show Statistics */}
        <Card className="mb-4">
          <View className="flex-row items-center justify-between">
            <View className="mr-4 flex-1">
              <Text className="mb-1 text-[12px] font-semibold text-[#f8fafc]">
                Show Statistics
              </Text>
              <Text className="text-[12px] leading-[18px] text-[#94a3b8]">
                Display your catch stats and achievements
              </Text>
            </View>
            <Switch
              value={showStats}
              onValueChange={setShowStats}
              trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
              thumbColor={showStats ? COLORS.primary : COLORS.textMuted}
              disabled={!isPublic}
            />
          </View>
        </Card>

        {/* Profile Link Section */}
        {isPublic && (
          <>
            <Card className="mb-4 p-6">
              <Text className="mb-3 text-[13px] font-bold text-[#f8fafc]">
                Profile Link
              </Text>

              {/* Custom Slug Display */}
              <View className="mb-4 flex-row items-end gap-2.5">
                <Input
                  label="Profile Slug"
                  value={customSlug}
                  editable={false}
                  containerStyle={{ flex: 1 }}
                  leftIcon={
                    <Ionicons
                      name="link-outline"
                      size={20}
                      color={COLORS.textMuted}
                    />
                  }
                />
                <Button
                  label="Generate"
                  onPress={handleGenerateSlug}
                  loading={generatingSlug}
                  variant="outline"
                  size="sm"
                  className="mb-2"
                />
              </View>

              {/* Full URL Display */}
              {profileUrl && (
                <View className="mb-6">
                  <Text className="mb-2 text-[12px] font-semibold text-[#e2e8f0]">
                    Shareable Link:
                  </Text>
                  <TouchableOpacity
                    className="flex-row items-center justify-between gap-2 rounded-xl border border-[#334155] bg-[#334155] p-4"
                    onPress={() => {
                      // Copy to clipboard functionality could be added here
                      Alert.alert("Profile URL", profileUrl);
                    }}
                  >
                    <Text
                      className="flex-1 text-[12px] text-[#3b82f6]"
                      numberOfLines={1}
                    >
                      {profileUrl}
                    </Text>
                    <Ionicons
                      name="copy-outline"
                      size={20}
                      color={COLORS.primary}
                    />
                  </TouchableOpacity>
                </View>
              )}

              {/* QR Code */}
              {profileUrl && (
                <View className="mb-6 items-center">
                  <Text className="mb-4 text-[12px] font-semibold text-[#e2e8f0]">
                    QR Code
                  </Text>
                  <View className="mb-2 rounded-xl border-2 border-[#334155] bg-[#1e293b] p-4">
                    <QRCode
                      value={profileUrl}
                      size={200}
                      color={COLORS.textPrimary}
                      backgroundColor={COLORS.bgCard}
                    />
                  </View>
                  <Text className="text-center text-[10px] text-[#94a3b8]">
                    Others can scan this code to view your profile
                  </Text>
                </View>
              )}

              {/* Action Buttons */}
              <View className="gap-4">
                <Button
                  label="Share Profile"
                  onPress={handleShare}
                  variant="primary"
                  icon={
                    <Ionicons name="share-outline" size={20} color="#fff" />
                  }
                  iconPosition="left"
                  fullWidth
                  disabled={!profileUrl}
                />
                <Button
                  label="Preview"
                  onPress={handlePreview}
                  variant="outline"
                  icon={
                    <Ionicons
                      name="eye-outline"
                      size={20}
                      color={COLORS.primary}
                    />
                  }
                  iconPosition="left"
                  fullWidth
                />
              </View>
            </Card>
          </>
        )}

        {/* Save Button */}
        <View className="mb-6">
          <Button
            label="Save Settings"
            onPress={handleSave}
            loading={saving}
            variant="primary"
            size="lg"
            fullWidth
          />
        </View>

        {/* Privacy Notice */}
        <Card className="bg-[#334155]">
          <Text className="mb-2 text-[12px] font-semibold text-[#e2e8f0]">
            Privacy Notice
          </Text>
          <Text className="text-[12px] leading-5 text-[#94a3b8]">
            • Your public profile will be visible to anyone with the link{"\n"}•
            Only information you choose to share will be displayed{"\n"}• You
            can disable your public profile at any time{"\n"}• Your contact
            information is never shared publicly
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}
