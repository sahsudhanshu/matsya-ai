import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Stack, router } from "expo-router";
import { Avatar } from "../../components/ui/Avatar";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { SkeletonProfile } from "../../components/ui/Skeleton";
import { getPublicProfile } from "../../lib/api-client";
import { Ionicons } from "@expo/vector-icons";
import type { PublicProfile } from "../../lib/types";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";

export default function PublicProfilePreviewScreen() {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPublicProfile();
      setProfile(data);
    } catch (err) {
      console.error("Error loading public profile:", err);
      setError(err instanceof Error ? err.message : "Failed to load profile");
      Alert.alert("Error", "Failed to load public profile preview");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: "Public Profile Preview",
            headerBackTitle: "Back",
          }}
        />
        <ScrollView style={styles.scroll}>
          <SkeletonProfile />
        </ScrollView>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: "Public Profile Preview",
            headerBackTitle: "Back",
          }}
        />
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || "Profile not found"}</Text>
          <Text style={styles.retryButton} onPress={loadProfile}>
            Retry
          </Text>
        </View>
      </View>
    );
  }

  if (!profile.isPublic) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: "Public Profile Preview",
            headerBackTitle: "Back",
          }}
        />
        <View style={styles.centered}>
          <Text style={styles.infoText}>
            Your profile is currently private.
          </Text>
          <Text style={styles.infoSubtext}>
            Enable public profile in settings to share it with others.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Public Profile Preview",
          headerBackTitle: "Back",
        }}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Preview Notice */}
        <Card style={styles.noticeCard}>
          <Text style={styles.noticeText}>
            👁️ This is how others will see your public profile
          </Text>
        </Card>

        {/* Profile Header */}
        <Card style={styles.headerCard}>
          <View style={styles.avatarContainer}>
            <Avatar uri={profile.avatarUrl} name={profile.name} size="xl" />
          </View>
          <Text style={styles.name}>{profile.name}</Text>
          {profile.role && (
            <View style={styles.roleContainer}>
              <Badge label={profile.role} variant="info" />
            </View>
          )}
          {profile.port && (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Ionicons
                name="location-sharp"
                size={12}
                color={COLORS.textMuted}
              />
              <Text style={styles.location}>{profile.port}</Text>
            </View>
          )}
          {profile.region && (
            <Text style={styles.region}>{profile.region}</Text>
          )}
        </Card>

        {/* Statistics Section */}
        {profile.showStats && profile.stats && (
          <Card style={styles.statsCard}>
            <Text style={styles.sectionTitle}>Fishing Statistics</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>
                  {profile.stats.totalCatches}
                </Text>
                <Text style={styles.statLabel}>Total Catches</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>
                  {profile.stats.speciesCount}
                </Text>
                <Text style={styles.statLabel}>Species Caught</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>
                  ₹{profile.stats.totalEarnings.toLocaleString()}
                </Text>
                <Text style={styles.statLabel}>Total Earnings</Text>
              </View>
            </View>

            {/* Species Distribution */}
            {profile.stats.speciesDistribution &&
              Object.keys(profile.stats.speciesDistribution).length > 0 && (
                <View style={styles.speciesSection}>
                  <Text style={styles.subsectionTitle}>Top Species</Text>
                  {Object.entries(profile.stats.speciesDistribution)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([species, count]) => (
                      <View key={species} style={styles.speciesRow}>
                        <Text style={styles.speciesName}>{species}</Text>
                        <Text style={styles.speciesCount}>{count} catches</Text>
                      </View>
                    ))}
                </View>
              )}
          </Card>
        )}

        {/* Member Since */}
        <Card style={styles.infoCard}>
          <Text style={styles.infoLabel}>Member Since</Text>
          <Text style={styles.infoValue}>
            {new Date(profile.createdAt).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </Text>
        </Card>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Powered by OceanAI - AI for Bharat Fishermen
          </Text>
        </View>
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
    paddingBottom: SPACING["3xl"],
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.xl,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  errorText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.error,
    textAlign: "center",
    marginBottom: SPACING.md,
  },
  retryButton: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: FONTS.weights.semibold as any,
  },
  infoText: {
    fontSize: FONTS.sizes.base,
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  infoSubtext: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    textAlign: "center",
  },
  noticeCard: {
    backgroundColor: COLORS.primary + "15",
    borderColor: COLORS.primary + "40",
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  noticeText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    textAlign: "center",
  },
  headerCard: {
    alignItems: "center",
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  avatarContainer: {
    marginBottom: SPACING.md,
  },
  name: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold as any,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  roleContainer: {
    marginVertical: SPACING.sm,
  },
  location: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  region: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  statsCard: {
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold as any,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: SPACING.lg,
  },
  statBox: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold as any,
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    textAlign: "center",
  },
  speciesSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
  },
  subsectionTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semibold as any,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  speciesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  speciesName: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
  },
  speciesCount: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
  },
  infoCard: {
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  infoLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  infoValue: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.semibold as any,
  },
  footer: {
    alignItems: "center",
    marginTop: SPACING.lg,
  },
  footerText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSubtle,
    textAlign: "center",
  },
});
