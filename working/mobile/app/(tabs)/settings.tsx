import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  ActivityIndicator,
  ScrollView,
  FlatList,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { useLanguage } from "../../lib/i18n";
import { ProfileMenu } from "../../components/ui/ProfileMenu";
import {
  COLORS,
  FONTS,
  SPACING,
  RADIUS,
  INDIAN_LANGUAGES,
} from "../../lib/constants";
import { Card } from "../../components/ui/Card";
import { PublicProfileCard } from "../../components/profile/PublicProfileCard";
import { SettingsSection } from "../../components/settings/SettingsSection";
import { PreferenceRow } from "../../components/settings/PreferenceRow";
import { ChangePasswordModal } from "../../components/settings/ChangePasswordModal";
import { ExportDataModal } from "../../components/settings/ExportDataModal";
import { DeleteAccountModal } from "../../components/settings/DeleteAccountModal";
import {
  getPublicProfile,
  updatePublicProfile,
  getUserPreferences,
  updateUserPreferences,
  getConversationsList,
  deleteConversation,
} from "../../lib/api-client";
import { ShareService } from "../../lib/share-service";
import type { PublicProfile, UserPreferences } from "../../lib/types";
import { SyncService } from "../../lib/sync-service";
import type { SyncStatus } from "../../lib/sync-service";
import { syncLogger } from "../../lib/sync-logger";
import type { SyncLogEntry } from "../../lib/sync-logger";

function formatLastSync(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const LOG_LEVEL_COLOR: Record<SyncLogEntry["level"], string> = {
  info:    "#94a3b8",
  success: "#4ade80",
  warn:    "#fbbf24",
  error:   "#f87171",
};

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { t, locale, setLocale, isLoaded } = useLanguage();
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [deleteAccountModalVisible, setDeleteAccountModalVisible] =
    useState(false);
  const [boatTypeModalVisible, setBoatTypeModalVisible] = useState(false);
  const [weightUnitModalVisible, setWeightUnitModalVisible] = useState(false);

  // Public profile state
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(
    null,
  );
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Preferences state
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loadingPreferences, setLoadingPreferences] = useState(true);

  // Sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncLogs, setShowSyncLogs] = useState(false);

  useEffect(() => {
    loadPublicProfile();
    loadPreferences();
  }, []);

  useEffect(() => {
    SyncService.getSyncStatus().then(setSyncStatus);
    const unsubStatus = SyncService.subscribe((status) => {
      setSyncStatus(status);
      setIsSyncing(status.syncing);
    });
    setSyncLogs(syncLogger.getEntries());
    const unsubLogs = syncLogger.subscribe(setSyncLogs);
    return () => { unsubStatus(); unsubLogs(); };
  }, []);

  const loadPublicProfile = async () => {
    try {
      setLoadingProfile(true);
      const profile = await getPublicProfile();
      setPublicProfile(profile);
    } catch (err) {
      console.error("Error loading public profile:", err);
      // Don't show error for demo mode
      if (err instanceof Error && !err.message.includes("demo mode")) {
        Alert.alert("Error", "Failed to load public profile settings");
      }
    } finally {
      setLoadingProfile(false);
    }
  };

  const loadPreferences = async () => {
    try {
      setLoadingPreferences(true);
      const prefs = await getUserPreferences();
      setPreferences(prefs);
    } catch (err) {
      console.error("Error loading preferences:", err);
    } finally {
      setLoadingPreferences(false);
    }
  };

  const updatePreference = async (updates: Partial<UserPreferences>) => {
    if (!preferences) return;

    try {
      const updated = await updateUserPreferences(updates);
      setPreferences(updated);
    } catch (err) {
      console.error("Error updating preferences:", err);
      // Queue for offline sync
      const { SyncService } = await import("../../lib/sync-service");
      await SyncService.queueChange("preferences_update", updates);
      Alert.alert("Queued", "Your changes will sync when you're back online");
    }
  };

  const handleTogglePublic = async (value: boolean) => {
    if (!publicProfile) return;

    try {
      setUpdatingProfile(true);

      // If enabling public profile for the first time and no slug exists,
      // generate one client-side (matching frontend approach)
      let slug = publicProfile.slug || undefined;
      if (value && !slug) {
        const name = (user?.name || publicProfile.name || "fisherman");
        const base = name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "-")
          .replace(/-+/g, "-")
          .slice(0, 20);
        slug = `${base}-${(user?.userId || "").slice(0, 8)}`;
      }

      const updated = await updatePublicProfile({
        isPublic: value,
        showStats: publicProfile.showStats,
        slug,
      });
      setPublicProfile(updated);
    } catch (err) {
      console.error("Error updating public profile:", err);
      Alert.alert("Error", "Failed to update public profile settings");
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleToggleStats = async (value: boolean) => {
    if (!publicProfile) return;

    try {
      setUpdatingProfile(true);
      const updated = await updatePublicProfile({
        isPublic: publicProfile.isPublic,
        showStats: value,
      });
      setPublicProfile(updated);
    } catch (err) {
      console.error("Error updating stats visibility:", err);
      Alert.alert("Error", "Failed to update statistics visibility");
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleShareProfile = async () => {
    if (!publicProfile) return;

    const url = `https://oceanai.app/profile/${publicProfile.slug}`;
    const message = `Check out my fishing profile on OceanAI!\n\n${publicProfile.name}\n${publicProfile.role || "Fisherman"}\n`;

    try {
      await ShareService.shareUrl(url, message);
    } catch (err) {
      console.error("Error sharing profile:", err);
      Alert.alert("Error", "Failed to share profile");
    }
  };

  const handlePreviewProfile = () => {
    router.push("/profile/public" as any);
  };

  const handleLogout = () => {
    Alert.alert(t("settings.logout"), t("settings.logoutConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.logout"),
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/auth/login");
        },
      },
    ]);
  };

  const handleManualSync = async () => {
    if (isSyncing) return;
    try {
      await SyncService.manualSync();
    } catch (err) {
      Alert.alert(
        "Sync Failed",
        err instanceof Error ? err.message : "No internet connection. Please try again when online.",
      );
    }
  };

  const languageDisplayNames: Record<string, string> = {
    en: "English",
    hi: "हिन्दी (Hindi)",
    bn: "বাংলা (Bengali)",
    ta: "தமிழ் (Tamil)",
    te: "తెలుగు (Telugu)",
    mr: "मराठी (Marathi)",
  };

  if (!isLoaded) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t("nav.settings")}</Text>
          <ProfileMenu size={36} />
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {(user?.name ?? "F")[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name ?? "Fisherman"}</Text>
            <Text style={styles.profileEmail}>{user?.email ?? ""}</Text>
            {user?.location && (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Ionicons
                  name="location-sharp"
                  size={12}
                  color={COLORS.textMuted}
                />
                <Text style={styles.profileLocation}>{user.location}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Account Info */}
        <Text style={styles.sectionLabel}>{t("settings.account")}</Text>
        <Card padding={0} style={styles.menuCard}>
          {user?.phone && (
            <PreferenceRow
              label={t("settings.phone")}
              type="action"
              value={user.phone}
              onPress={() => {}}
            />
          )}
          <PreferenceRow
            label={t("settings.location")}
            type="action"
            value={user?.location ?? "Not set"}
            onPress={() => {}}
          />
          <PreferenceRow
            label={t("settings.memberSince")}
            type="action"
            value="Feb 2026"
            onPress={() => {}}
          />
          <PreferenceRow
            label="Edit Profile"
            type="action"
            onPress={() => router.push("/profile/edit" as any)}
          />
        </Card>

        {/* Public Profile Section */}
        <Text style={styles.sectionLabel}>Public Profile</Text>
        {loadingProfile ? (
          <Card style={styles.loadingCard}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading profile settings...</Text>
          </Card>
        ) : publicProfile ? (
          <>
            <PublicProfileCard
              profile={publicProfile}
              onTogglePublic={handleTogglePublic}
              onToggleStats={handleToggleStats}
              onShare={handleShareProfile}
              onPreview={handlePreviewProfile}
              loading={updatingProfile}
            />
            <Card padding={0} style={styles.menuCard}>
              <PreferenceRow
                label="Configure Public Profile"
                type="action"
                onPress={() => router.push("/profile/public-profile" as any)}
              />
            </Card>
          </>
        ) : null}

        {/* Preferences */}
        <Text style={styles.sectionLabel}>{t("settings.preferences")}</Text>
        <Card padding={0} style={styles.menuCard}>
          <PreferenceRow
            label={t("settings.notifications")}
            type="toggle"
            value={preferences?.notifications ?? true}
            onValueChange={(v) => updatePreference({ notifications: v })}
            description={t("settings.notificationsDesc")}
          />
          <PreferenceRow
            label="Offline Sync"
            type="toggle"
            value={preferences?.offlineSync ?? true}
            onValueChange={(v) => updatePreference({ offlineSync: v })}
            description="Automatically sync data when online"
          />
        </Card>

        {/* Fishing Preferences */}
        <Text style={styles.sectionLabel}>Fishing Preferences</Text>
        <Card padding={0} style={styles.menuCard}>
          <PreferenceRow
            label="Boat Type"
            type="select"
            value={preferences?.boatType || "Not set"}
            onPress={() => setBoatTypeModalVisible(true)}
          />
          <PreferenceRow
            label={t("settings.weightUnit")}
            type="select"
            value={
              preferences?.units === "kg"
                ? "Kilograms"
                : preferences?.units === "lb"
                  ? "Pounds"
                  : "Grams"
            }
            onPress={() => setWeightUnitModalVisible(true)}
          />
          <PreferenceRow
            label="Primary Fishing Port"
            type="select"
            value={user?.port || "Not set"}
            onPress={() => router.push("/profile/edit" as any)}
          />
          <PreferenceRow
            label="Region"
            type="select"
            value={user?.region || "Not set"}
            onPress={() => router.push("/profile/edit" as any)}
          />
        </Card>

        {/* Language */}
        <Text style={styles.sectionLabel}>{t("settings.language")}</Text>
        <Card padding={0} style={styles.menuCard}>
          <PreferenceRow
            label={t("settings.appLanguage")}
            type="select"
            value={languageDisplayNames[locale] ?? "English"}
            onPress={() => setLangModalVisible(true)}
          />
        </Card>

        {/* Privacy & Security */}
        <Text style={styles.sectionLabel}>{t("settings.privacy")}</Text>
        <Card padding={0} style={styles.menuCard}>
          <PreferenceRow
            label={t("settings.changePassword")}
            type="action"
            onPress={() => setPasswordModalVisible(true)}
          />
          <PreferenceRow
            label={t("settings.exportData")}
            type="action"
            onPress={() => setExportModalVisible(true)}
          />
          <PreferenceRow
            label={t("settings.deleteAccount")}
            type="action"
            onPress={() => setDeleteAccountModalVisible(true)}
            danger
          />
        </Card>

        {/* AI Agent */}
        <Text style={styles.sectionLabel}>AI Agent</Text>
        <Card padding={0} style={styles.menuCard}>
          <PreferenceRow
            label="Agent Memory"
            type="action"
            value="View conversation history"
            onPress={async () => {
              try {
                const list = await getConversationsList();
                Alert.alert(
                  "Agent Memory",
                  list.length === 0
                    ? "No conversations stored yet. Start chatting to build your history."
                    : `You have ${list.length} stored conversation${list.length !== 1 ? "s" : ""}. Open the chat and tap the menu icon to browse and manage them.`,
                  [
                    { text: "OK" },
                    {
                      text: "Open Chat",
                      onPress: () => router.push("/(tabs)/chat"),
                    },
                  ],
                );
              } catch {
                Alert.alert("Error", "Could not fetch conversation history.");
              }
            }}
          />
          <PreferenceRow
            label="Clear Agent Memory"
            type="action"
            value="Delete all conversations"
            onPress={() => {
              Alert.alert(
                "Clear Agent Memory",
                "This will permanently delete all your conversations from the server. This cannot be undone.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete All",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        const list = await getConversationsList();
                        if (list.length === 0) {
                          Alert.alert(
                            "Nothing to Delete",
                            "You have no stored conversations.",
                          );
                          return;
                        }
                        await Promise.all(
                          list.map((c) => deleteConversation(c.conversationId)),
                        );
                        Alert.alert(
                          "Done",
                          `Deleted ${list.length} conversation${list.length !== 1 ? "s" : ""} successfully.`,
                        );
                      } catch {
                        Alert.alert(
                          "Error",
                          "Failed to delete some conversations. Please try again.",
                        );
                      }
                    },
                  },
                ],
              );
            }}
          />
        </Card>

        {/* Data Sync */}
        <Text style={styles.sectionLabel}>Data Sync</Text>
        <Card padding={SPACING.md} style={[styles.menuCard, { padding: SPACING.md }]}>
          {/* Status row */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.sm }}>
            <View>
              <Text style={{ fontSize: FONTS.sizes.sm, color: COLORS.textPrimary, fontWeight: FONTS.weights.semibold }}>
                Last synced
              </Text>
              <Text style={{ fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2 }}>
                {syncStatus?.lastSync ? formatLastSync(syncStatus.lastSync) : "Never synced"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: SPACING.xs }}>
              {(syncStatus?.pending ?? 0) > 0 && (
                <View style={{ backgroundColor: COLORS.primary + "25", borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 2 }}>
                  <Text style={{ fontSize: FONTS.sizes.xs, color: COLORS.primaryLight, fontWeight: FONTS.weights.semibold }}>
                    {syncStatus!.pending} pending
                  </Text>
                </View>
              )}
              {(syncStatus?.failed ?? 0) > 0 && (
                <View style={{ backgroundColor: COLORS.error + "25", borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 2 }}>
                  <Text style={{ fontSize: FONTS.sizes.xs, color: COLORS.error, fontWeight: FONTS.weights.semibold }}>
                    {syncStatus!.failed} failed
                  </Text>
                </View>
              )}
            </View>
          </View>
          {/* Sync Now button */}
          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: SPACING.xs,
              backgroundColor: COLORS.primary,
              borderRadius: RADIUS.md,
              padding: SPACING.sm,
              opacity: isSyncing ? 0.6 : 1,
            }}
            onPress={handleManualSync}
            disabled={isSyncing}
            activeOpacity={0.8}
          >
            {isSyncing
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="sync" size={16} color="#fff" />
            }
            <Text style={{ fontSize: FONTS.sizes.sm, color: "#fff", fontWeight: FONTS.weights.semibold }}>
              {isSyncing ? "Syncing…" : "Sync Now"}
            </Text>
          </TouchableOpacity>
        </Card>

        {/* Sync Logs toggle */}
        <TouchableOpacity
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: SPACING.xs, paddingHorizontal: SPACING.xs, marginBottom: SPACING.xs }}
          onPress={() => setShowSyncLogs((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: FONTS.sizes.xs, color: COLORS.textSubtle, textTransform: "uppercase", letterSpacing: 0.6 }}>
            Sync Logs{syncLogs.length > 0 ? ` (${syncLogs.length})` : ""}
          </Text>
          <Ionicons name={showSyncLogs ? "chevron-up" : "chevron-down"} size={14} color={COLORS.textSubtle} />
        </TouchableOpacity>
        {showSyncLogs && (
          <Card padding={SPACING.sm} style={[styles.menuCard, { maxHeight: 300 }]}>
            {syncLogs.length === 0 ? (
              <Text style={{ fontSize: FONTS.sizes.xs, color: COLORS.textSubtle, textAlign: "center", padding: SPACING.sm }}>
                No sync events yet
              </Text>
            ) : (
              <FlatList
                data={syncLogs}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 240 }}
                showsVerticalScrollIndicator={true}
                renderItem={({ item }) => (
                  <View style={{ flexDirection: "row", alignItems: "flex-start", paddingVertical: 3, gap: 6 }}>
                    <Text style={{ fontSize: 10, color: LOG_LEVEL_COLOR[item.level], marginTop: 1 }}>●</Text>
                    <Text style={{ fontSize: 10, color: COLORS.textSubtle, width: 52 }}>{item.time}</Text>
                    <Text style={{ fontSize: 10, color: COLORS.textMuted, width: 76 }}>[{item.source}]</Text>
                    <Text style={{ fontSize: 10, color: COLORS.textSecondary, flex: 1 }}>{item.message}</Text>
                  </View>
                )}
              />
            )}
            {syncLogs.length > 0 && (
              <TouchableOpacity
                onPress={() => syncLogger.clear()}
                style={{ alignItems: "center", paddingTop: SPACING.xs, marginTop: SPACING.xs, borderTopWidth: 1, borderTopColor: COLORS.border }}
              >
                <Text style={{ fontSize: FONTS.sizes.xs, color: COLORS.textSubtle }}>Clear logs</Text>
              </TouchableOpacity>
            )}
          </Card>
        )}

        {/* Help */}
        <Text style={styles.sectionLabel}>{t("settings.help")}</Text>
        <Card padding={0} style={styles.menuCard}>
          <PreferenceRow
            label="Documentation"
            type="action"
            onPress={() => router.push("/settings/documentation" as any)}
          />
          <PreferenceRow
            label="Help & Support"
            type="action"
            onPress={() => router.push("/settings/help" as any)}
          />
          <PreferenceRow
            label={t("settings.appVersion")}
            type="action"
            value="1.0.0"
            onPress={() => {}}
          />
        </Card>

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutText}>🚪 {t("settings.logout")}</Text>
        </TouchableOpacity>

        {/* App Info */}
        <Text style={styles.appInfo}>
          OceanAI v1.0.0 · AWS AI for Bharat Challenge
        </Text>
      </KeyboardAwareScrollView>

      {/* Language Modal */}
      <Modal
        visible={langModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLangModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {t("settings.selectLanguage")}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {Object.entries(languageDisplayNames).map(
                ([code, displayName]) => (
                  <TouchableOpacity
                    key={code}
                    style={[
                      styles.langOption,
                      code === locale && styles.langOptionActive,
                    ]}
                    onPress={() => {
                      setLocale(code as any);
                      setLangModalVisible(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.langOptionText,
                        code === locale && styles.langOptionTextActive,
                      ]}
                    >
                      {displayName}
                    </Text>
                    {code === locale && (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={COLORS.primaryLight}
                      />
                    )}
                  </TouchableOpacity>
                ),
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Password Change Modal */}
      <ChangePasswordModal
        visible={passwordModalVisible}
        onClose={() => setPasswordModalVisible(false)}
      />

      {/* Export Data Modal */}
      <ExportDataModal
        visible={exportModalVisible}
        onClose={() => setExportModalVisible(false)}
      />

      {/* Delete Account Modal */}
      <DeleteAccountModal
        visible={deleteAccountModalVisible}
        onClose={() => setDeleteAccountModalVisible(false)}
        onConfirm={async () => {
          // Clear local data and logout
          await AsyncStorage.clear();
          await logout();
          router.replace("/auth/login");
        }}
      />

      {/* Boat Type Modal */}
      <Modal
        visible={boatTypeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBoatTypeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select Boat Type</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                "Trawler",
                "Gill Netter",
                "Purse Seiner",
                "Catamaran",
                "Country Craft",
                "Motorized",
                "Non-Motorized",
              ].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.langOption,
                    preferences?.boatType === type && styles.langOptionActive,
                  ]}
                  onPress={() => {
                    updatePreference({ boatType: type });
                    setBoatTypeModalVisible(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.langOptionText,
                      preferences?.boatType === type &&
                        styles.langOptionTextActive,
                    ]}
                  >
                    {type}
                  </Text>
                  {preferences?.boatType === type && (
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color={COLORS.primaryLight}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Weight Unit Modal */}
      <Modal
        visible={weightUnitModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setWeightUnitModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select Weight Unit</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { label: "Kilograms (kg)", value: "kg" },
                { label: "Pounds (lb)", value: "lb" },
                { label: "Grams (g)", value: "g" },
              ].map((unit) => (
                <TouchableOpacity
                  key={unit.value}
                  style={[
                    styles.langOption,
                    preferences?.units === unit.value &&
                      styles.langOptionActive,
                  ]}
                  onPress={() => {
                    updatePreference({ units: unit.value });
                    setWeightUnitModalVisible(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.langOptionText,
                      preferences?.units === unit.value &&
                        styles.langOptionTextActive,
                    ]}
                  >
                    {unit.label}
                  </Text>
                  {preferences?.units === unit.value && (
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color={COLORS.primaryLight}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgDark },
  scroll: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: SPACING["3xl"] },

  header: {
    marginBottom: SPACING.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: FONTS.sizes.xl,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.bold,
  },

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: {
    fontSize: FONTS.sizes.lg,
    color: "#fff",
    fontWeight: FONTS.weights.bold,
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
  },
  profileEmail: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  profileLocation: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSubtle,
    marginTop: 2,
  },

  sectionLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSubtle,
    fontWeight: FONTS.weights.semibold,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },

  menuCard: {
    marginBottom: SPACING.xs,
    overflow: "hidden",
  },

  logoutBtn: {
    backgroundColor: COLORS.error + "15",
    borderWidth: 1,
    borderColor: COLORS.error + "40",
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    alignItems: "center",
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  logoutText: {
    color: COLORS.error,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
  },

  appInfo: {
    textAlign: "center",
    color: COLORS.textSubtle,
    fontSize: FONTS.sizes.xs,
    marginBottom: SPACING.sm,
  },

  loadingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.xl,
  },
  modalSheet: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING["2xl"],
    maxHeight: "80%",
    width: "100%",
  },
  modalTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  langOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  langOptionActive: {
    backgroundColor: COLORS.primary + "15",
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
  },
  langOptionText: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary },
  langOptionTextActive: {
    color: COLORS.primaryLight,
    fontWeight: FONTS.weights.bold,
  },
});
