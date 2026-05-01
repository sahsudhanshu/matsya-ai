import React, { useState, useEffect } from "react";
import {
  View,
  Text,
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
  info: "#94a3b8",
  success: "#4ade80",
  warn: "#fbbf24",
  error: "#f87171",
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
    return () => {
      unsubStatus();
      unsubLogs();
    };
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
        const name = user?.name || publicProfile.name || "fisherman";
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
    const message = `Check out my fishing profile on Matsya AI!\n\n${publicProfile.name}\n${publicProfile.role || "Fisherman"}\n`;

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
        err instanceof Error
          ? err.message
          : "No internet connection. Please try again when online.",
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerClassName="p-6 pb-16"
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
      >
        {/* Header */}
        <View className="mb-6 flex-row justify-between items-center">
          <Text className="text-xl text-slate-50 font-bold">{t("nav.settings")}</Text>
          <ProfileMenu size={36} />
        </View>

        {/* Profile Card */}
        <View className="flex-row items-center bg-slate-800 rounded-[20px] border border-slate-700 p-4 mb-6 gap-2">
          <View className="w-12 h-12 rounded-full bg-blue-800 items-center justify-center">
            <Text className="text-[17px] text-white font-bold">
              {(user?.name ?? "F")[0].toUpperCase()}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-[13px] font-semibold text-slate-50">{user?.name ?? "Fisherman"}</Text>
            <Text className="text-xs text-slate-400 mt-0.5">{user?.email ?? ""}</Text>
            {user?.location && (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Ionicons
                  name="location-sharp"
                  size={12}
                  color={COLORS.textMuted}
                />
                <Text className="text-[10px] text-slate-500 mt-0.5">{user.location}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Account Info */}
        <Text className="text-[10px] text-slate-500 font-semibold tracking-wide uppercase mb-1 mt-2 px-1">{t("settings.account")}</Text>
        <Card padding={0} className="mb-1 overflow-hidden">
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
        <Text className="text-xs font-bold color-[#94a3b8] uppercase tracking-[0.8px] mb-2 ml-1 mt-4">Public Profile</Text>
        {loadingProfile ? (
          <Card className="flex-row items-center justify-center p-6 gap-4">
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text className="text-xs text-slate-400">Loading profile settings...</Text>
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
            <Card padding={0} className="mb-4">
              <PreferenceRow
                label="Configure Public Profile"
                type="action"
                onPress={() => router.push("/profile/public-profile" as any)}
              />
            </Card>
          </>
        ) : null}

        {/* Preferences */}
        <Text className="text-xs font-bold color-[#94a3b8] uppercase tracking-[0.8px] mb-2 ml-1 mt-4">{t("settings.preferences")}</Text>
        <Card padding={0} className="mb-4">
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
        <Text className="text-xs font-bold color-[#94a3b8] uppercase tracking-[0.8px] mb-2 ml-1 mt-4">Fishing Preferences</Text>
        <Card padding={0} className="mb-4">
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
        <Text className="text-xs font-bold color-[#94a3b8] uppercase tracking-[0.8px] mb-2 ml-1 mt-4">{t("settings.language")}</Text>
        <Card padding={0} className="mb-4">
          <PreferenceRow
            label={t("settings.appLanguage")}
            type="select"
            value={languageDisplayNames[locale] ?? "English"}
            onPress={() => setLangModalVisible(true)}
          />
        </Card>

        {/* Privacy & Security */}
        <Text className="text-xs font-bold color-[#94a3b8] uppercase tracking-[0.8px] mb-2 ml-1 mt-4">{t("settings.privacy")}</Text>
        <Card padding={0} className="mb-4">
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
        <Text className="text-xs font-bold color-[#94a3b8] uppercase tracking-[0.8px] mb-2 ml-1 mt-4">AI Agent</Text>
        <Card padding={0} className="mb-4">
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
        <Text className="text-xs font-bold color-[#94a3b8] uppercase tracking-[0.8px] mb-2 ml-1 mt-4">Data Sync</Text>
        <Card
          padding={SPACING.md}
          className="mb-1 overflow-hidden p-4"
        >
          {/* Status row */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: SPACING.sm,
            }}
          >
            <View>
              <Text
                style={{
                  fontSize: FONTS.sizes.sm,
                  color: COLORS.textPrimary,
                  fontWeight: FONTS.weights.semibold,
                }}
              >
                Last synced
              </Text>
              <Text
                style={{
                  fontSize: FONTS.sizes.xs,
                  color: COLORS.textMuted,
                  marginTop: 2,
                }}
              >
                {syncStatus?.lastSync
                  ? formatLastSync(syncStatus.lastSync)
                  : "Never synced"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: SPACING.xs }}>
              {(syncStatus?.pending ?? 0) > 0 && (
                <View
                  style={{
                    backgroundColor: COLORS.primary + "25",
                    borderRadius: RADIUS.sm,
                    paddingHorizontal: SPACING.sm,
                    paddingVertical: 2,
                  }}
                >
                  <Text
                    style={{
                      fontSize: FONTS.sizes.xs,
                      color: COLORS.primaryLight,
                      fontWeight: FONTS.weights.semibold,
                    }}
                  >
                    {syncStatus!.pending} pending
                  </Text>
                </View>
              )}
              {(syncStatus?.failed ?? 0) > 0 && (
                <View
                  style={{
                    backgroundColor: COLORS.error + "25",
                    borderRadius: RADIUS.sm,
                    paddingHorizontal: SPACING.sm,
                    paddingVertical: 2,
                  }}
                >
                  <Text
                    style={{
                      fontSize: FONTS.sizes.xs,
                      color: COLORS.error,
                      fontWeight: FONTS.weights.semibold,
                    }}
                  >
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
            {isSyncing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="sync" size={16} color="#fff" />
            )}
            <Text
              style={{
                fontSize: FONTS.sizes.sm,
                color: "#fff",
                fontWeight: FONTS.weights.semibold,
              }}
            >
              {isSyncing ? "Syncing…" : "Sync Now"}
            </Text>
          </TouchableOpacity>
        </Card>

        {/* Sync Logs toggle */}
        <TouchableOpacity
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: SPACING.xs,
            paddingHorizontal: SPACING.xs,
            marginBottom: SPACING.xs,
          }}
          onPress={() => setShowSyncLogs((v) => !v)}
          activeOpacity={0.7}
        >
          <Text
            style={{
              fontSize: FONTS.sizes.xs,
              color: COLORS.textSubtle,
              textTransform: "uppercase",
              letterSpacing: 0.6,
            }}
          >
            Sync Logs{syncLogs.length > 0 ? ` (${syncLogs.length})` : ""}
          </Text>
          <Ionicons
            name={showSyncLogs ? "chevron-up" : "chevron-down"}
            size={14}
            color={COLORS.textSubtle}
          />
        </TouchableOpacity>
        {showSyncLogs && (
          <Card
            padding={SPACING.sm}
            className="mb-1 overflow-hidden max-h-[300px]"
          >
            {syncLogs.length === 0 ? (
              <Text
                style={{
                  fontSize: FONTS.sizes.xs,
                  color: COLORS.textSubtle,
                  textAlign: "center",
                  padding: SPACING.sm,
                }}
              >
                No sync events yet
              </Text>
            ) : (
              <FlatList
                data={syncLogs}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 240 }}
                showsVerticalScrollIndicator={true}
                renderItem={({ item }) => (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      paddingVertical: 3,
                      gap: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        color: LOG_LEVEL_COLOR[item.level],
                        marginTop: 1,
                      }}
                    >
                      ●
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        color: COLORS.textSubtle,
                        width: 52,
                      }}
                    >
                      {item.time}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        color: COLORS.textMuted,
                        width: 76,
                      }}
                    >
                      [{item.source}]
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        color: COLORS.textSecondary,
                        flex: 1,
                      }}
                    >
                      {item.message}
                    </Text>
                  </View>
                )}
              />
            )}
            {syncLogs.length > 0 && (
              <TouchableOpacity
                onPress={() => syncLogger.clear()}
                style={{
                  alignItems: "center",
                  paddingTop: SPACING.xs,
                  marginTop: SPACING.xs,
                  borderTopWidth: 1,
                  borderTopColor: COLORS.border,
                }}
              >
                <Text
                  style={{ fontSize: FONTS.sizes.xs, color: COLORS.textSubtle }}
                >
                  Clear logs
                </Text>
              </TouchableOpacity>
            )}
          </Card>
        )}

        {/* Help */}
        <Text className="text-xs font-bold color-[#94a3b8] uppercase tracking-[0.8px] mb-2 ml-1 mt-4">{t("settings.help")}</Text>
        <Card padding={0} className="mb-4">
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
          className="bg-red-500/15 border border-red-500/40 rounded-2xl p-2 items-center mt-6 mb-2"
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text className="text-red-500 text-xs font-semibold">🚪 {t("settings.logout")}</Text>
        </TouchableOpacity>

        {/* App Info */}
        <Text className="text-center text-slate-500 text-[10px] mb-2">
          Matsya AI v1.0.0 · AWS AI for Bharat Challenge
        </Text>
      </KeyboardAwareScrollView>

      {/* Language Modal */}
      <Modal
        visible={langModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLangModalVisible(false)}
      >
        <View className="flex-1 bg-black/70 justify-center items-center p-8">
          <View className="bg-slate-800 rounded-[20px] p-6 pb-12 max-h-[80%] w-full">
            <Text className="text-[13px] font-semibold text-slate-50 mb-2">
              {t("settings.selectLanguage")}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {Object.entries(languageDisplayNames).map(
                ([code, displayName]) => (
                  <TouchableOpacity
                    key={code}
                    className={`flex-row justify-between items-center py-2 border-b border-slate-700 ${code === locale ? "bg-blue-800/15 rounded-xl px-2" : ""}`}
                    onPress={() => {
                      setLocale(code as any);
                      setLangModalVisible(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      className={`text-[13px] text-slate-200 ${code === locale ? "text-blue-500 font-bold" : ""}`}
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
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-[#1e293b] rounded-t-3xl p-6 pb-8">
            <Text className="text-xl font-bold color-[#f8fafc] mb-6 text-center">Select Boat Type</Text>
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
                  className={`flex-row justify-between items-center py-2 border-b border-slate-700 ${preferences?.boatType === type ? "bg-blue-800/15 rounded-xl px-2" : ""}`}
                  onPress={() => {
                    updatePreference({ boatType: type });
                    setBoatTypeModalVisible(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    className={`text-[13px] text-slate-200 ${preferences?.boatType === type ? "text-blue-500 font-bold" : ""}`}
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
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-[#1e293b] rounded-t-3xl p-6 pb-8">
            <Text className="text-xl font-bold color-[#f8fafc] mb-6 text-center">Select Weight Unit</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { label: "Kilograms (kg)", value: "kg" },
                { label: "Pounds (lb)", value: "lb" },
                { label: "Grams (g)", value: "g" },
              ].map((unit) => (
                <TouchableOpacity
                  key={unit.value}
                  className={`flex-row justify-between items-center py-2 border-b border-slate-700 ${preferences?.units === unit.value ? "bg-blue-800/15 rounded-xl px-2" : ""}`}
                  onPress={() => {
                    updatePreference({ units: unit.value });
                    setWeightUnitModalVisible(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    className={`text-[13px] text-slate-200 ${preferences?.units === unit.value ? "text-blue-500 font-bold" : ""}`}
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

