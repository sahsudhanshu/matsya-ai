import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  Clipboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "../ui/Avatar";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import type { PublicProfile } from "../../lib/types";

interface PublicProfileCardProps {
  profile: PublicProfile;
  onTogglePublic: (value: boolean) => void;
  onToggleStats: (value: boolean) => void;
  onShare: () => void;
  onPreview: () => void;
  loading?: boolean;
}

export function PublicProfileCard({
  profile,
  onTogglePublic,
  onToggleStats,
  onShare,
  onPreview,
  loading = false,
}: PublicProfileCardProps) {
  const publicUrl = `https://oceanai.app/profile/${profile.slug}`;

  const handleCopyUrl = async () => {
    Clipboard.setString(publicUrl);
    Alert.alert("Copied", "Profile URL copied to clipboard");
  };

  return (
    <Card style={styles.container}>
      {/* Profile Preview */}
      <View style={styles.profileSection}>
        <Avatar uri={profile.avatarUrl} name={profile.name} size="lg" />
        <View style={styles.profileInfo}>
          <Text style={styles.name}>{profile.name}</Text>
          {profile.role && <Text style={styles.role}>{profile.role}</Text>}
          {profile.port && (
            <View style={styles.locationContainer}>
              <Ionicons
                name="location"
                size={14}
                color={COLORS.textSecondary}
              />
              <Text style={styles.location}>{profile.port}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Public Profile Toggle */}
      <View style={styles.settingRow}>
        <View style={styles.settingLeft}>
          <Text style={styles.settingLabel}>Public Profile</Text>
          <Text style={styles.settingDesc}>
            Allow others to view your profile
          </Text>
        </View>
        <Switch
          value={profile.isPublic}
          onValueChange={onTogglePublic}
          disabled={loading}
          trackColor={{ false: COLORS.border, true: COLORS.primary + "80" }}
          thumbColor={profile.isPublic ? COLORS.primary : COLORS.textSubtle}
        />
      </View>

      {!profile.isPublic && (
        <View style={styles.disabledMessage}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={COLORS.primary}
          />
          <Text style={styles.disabledMessageText}>
            Public profile is off. Turn it on to share your fishing profile with
            others.
          </Text>
        </View>
      )}

      {profile.isPublic && (
        <>
          {/* Show Statistics Toggle */}
          <View style={[styles.settingRow, styles.settingRowBorder]}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Show Fishing Statistics</Text>
              <Text style={styles.settingDesc}>
                Display catch stats on public profile
              </Text>
            </View>
            <Switch
              value={profile.showStats}
              onValueChange={onToggleStats}
              disabled={loading}
              trackColor={{ false: COLORS.border, true: COLORS.primary + "80" }}
              thumbColor={
                profile.showStats ? COLORS.primary : COLORS.textSubtle
              }
            />
          </View>

          {/* Statistics Display */}
          {profile.showStats && profile.stats && (
            <View style={styles.statsSection}>
              <Text style={styles.statsTitle}>Public Statistics</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {profile.stats.totalCatches}
                  </Text>
                  <Text style={styles.statLabel}>Total Catches</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {profile.stats.speciesCount}
                  </Text>
                  <Text style={styles.statLabel}>Species</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    ₹{profile.stats.totalEarnings.toLocaleString()}
                  </Text>
                  <Text style={styles.statLabel}>Earnings</Text>
                </View>
              </View>
            </View>
          )}

          {/* Public URL */}
          <View style={styles.urlSection}>
            <Text style={styles.urlLabel}>Your Public Profile URL</Text>
            <View style={styles.urlBox}>
              <Text style={styles.urlText} numberOfLines={1}>
                {publicUrl}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Button
              label="Copy URL"
              onPress={handleCopyUrl}
              variant="outline"
              style={styles.actionButton}
              disabled={loading}
            />
            <Button
              label="Share Profile"
              onPress={onShare}
              variant="outline"
              style={styles.actionButton}
              disabled={loading}
            />
          </View>

          <Button
            label="Preview Profile"
            onPress={onPreview}
            variant="primary"
            disabled={loading}
          />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.lg,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.lg,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  profileInfo: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  name: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold as any,
    color: COLORS.textPrimary,
  },
  role: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: SPACING.xs,
  },
  location: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.sm,
  },
  settingRowBorder: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  settingLeft: {
    flex: 1,
    marginRight: SPACING.md,
  },
  settingLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold as any,
    color: COLORS.textPrimary,
  },
  settingDesc: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  statsSection: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.bgDark,
    borderRadius: RADIUS.lg,
  },
  statsTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold as any,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold as any,
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  urlSection: {
    marginTop: SPACING.lg,
  },
  urlLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold as any,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  urlBox: {
    backgroundColor: COLORS.bgDark,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  urlText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontFamily: "monospace",
  },
  actions: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  actionButton: {
    flex: 1,
  },
  disabledMessage: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.primary + "10",
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
  disabledMessageText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});
