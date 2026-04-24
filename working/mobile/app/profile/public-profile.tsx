import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
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
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";

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
        message: `Check out my fishing profile on OceanAI: ${profileUrl}`,
        url: profileUrl,
        title: "My OceanAI Profile",
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
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: "Public Profile",
            headerBackTitle: "Back",
          }}
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading profile settings...</Text>
        </View>
      </View>
    );
  }

  if (error && !profile) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: "Public Profile",
            headerBackTitle: "Back",
          }}
        />
        <View style={styles.centered}>
          <Ionicons
            name="alert-circle-outline"
            size={64}
            color={COLORS.error}
          />
          <Text style={styles.errorText}>{error}</Text>
          <Button label="Retry" onPress={loadProfile} variant="primary" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Public Profile",
          headerBackTitle: "Back",
        }}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Card */}
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle" size={20} color={COLORS.info} />
            <Text style={styles.infoText}>
              Share your fishing achievements with others by enabling your
              public profile
            </Text>
          </View>
        </Card>

        {/* Enable Public Profile */}
        <Card style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Enable Public Profile</Text>
              <Text style={styles.settingDescription}>
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
        <Card style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Show Statistics</Text>
              <Text style={styles.settingDescription}>
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
            <Card style={styles.linkCard}>
              <Text style={styles.sectionTitle}>Profile Link</Text>

              {/* Custom Slug Display */}
              <View style={styles.slugContainer}>
                <Input
                  label="Profile Slug"
                  value={customSlug}
                  editable={false}
                  containerStyle={styles.slugInput}
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
                  style={styles.generateButton}
                />
              </View>

              {/* Full URL Display */}
              {profileUrl && (
                <View style={styles.urlContainer}>
                  <Text style={styles.urlLabel}>Shareable Link:</Text>
                  <TouchableOpacity
                    style={styles.urlBox}
                    onPress={() => {
                      // Copy to clipboard functionality could be added here
                      Alert.alert("Profile URL", profileUrl);
                    }}
                  >
                    <Text style={styles.urlText} numberOfLines={1}>
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
                <View style={styles.qrContainer}>
                  <Text style={styles.qrLabel}>QR Code</Text>
                  <View style={styles.qrCodeWrapper}>
                    <QRCode
                      value={profileUrl}
                      size={200}
                      color={COLORS.textPrimary}
                      backgroundColor={COLORS.bgCard}
                    />
                  </View>
                  <Text style={styles.qrDescription}>
                    Others can scan this code to view your profile
                  </Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
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
        <View style={styles.saveContainer}>
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
        <Card style={styles.privacyCard}>
          <Text style={styles.privacyTitle}>Privacy Notice</Text>
          <Text style={styles.privacyText}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING["2xl"],
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  errorText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.error,
    textAlign: "center",
    marginVertical: SPACING.md,
  },
  infoCard: {
    backgroundColor: COLORS.info + "15",
    borderColor: COLORS.info + "40",
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  infoText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.info,
    lineHeight: 20,
  },
  settingCard: {
    marginBottom: SPACING.md,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  settingLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  settingDescription: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  linkCard: {
    marginBottom: SPACING.md,
    padding: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  slugContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  slugInput: {
    flex: 1,
  },
  generateButton: {
    marginBottom: SPACING.sm,
  },
  urlContainer: {
    marginBottom: SPACING.lg,
  },
  urlLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  urlBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  urlText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontFamily: "monospace",
  },
  qrContainer: {
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  qrLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  qrCodeWrapper: {
    padding: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  qrDescription: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    textAlign: "center",
  },
  actionButtons: {
    gap: SPACING.md,
  },
  saveContainer: {
    marginBottom: SPACING.lg,
  },
  privacyCard: {
    backgroundColor: COLORS.bgSurface,
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  privacyTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  privacyText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    lineHeight: 20,
  },
});
