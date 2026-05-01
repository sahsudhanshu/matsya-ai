import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS } from "../../lib/constants";
import { SettingsSection } from "./SettingsSection";
import { PreferenceRow } from "./PreferenceRow";
import {
  requestNotificationPermissions,
  setNotificationsEnabled,
} from "../../lib/notification-service";
import { toastService } from "../../lib/toast-service";

interface PreferencesManagerProps {
  preferences: UserPreferences;
  onPreferencesChange: (preferences: UserPreferences) => void;
}

interface UserPreferences {
  language: string;
  units: {
    weight: "kg" | "lb";
    temperature: "celsius" | "fahrenheit";
    distance: "km" | "mi";
  };
  notifications: {
    pushEnabled: boolean;
    disasterAlerts: boolean;
    analysisComplete: boolean;
    chatMessages: boolean;
  };
  offlineSync: {
    autoSync: boolean;
    syncOnWifiOnly: boolean;
    cacheSize: "small" | "medium" | "large";
  };
}

const LANGUAGES = [
  { label: "English", value: "en" },
  { label: "हिन्दी (Hindi)", value: "hi" },
  { label: "தமிழ் (Tamil)", value: "ta" },
  { label: "मराठी (Marathi)", value: "mr" },
];

const WEIGHT_UNITS = [
  { label: "Kilograms (kg)", value: "kg" },
  { label: "Pounds (lb)", value: "lb" },
];

const TEMPERATURE_UNITS = [
  { label: "Celsius (°C)", value: "celsius" },
  { label: "Fahrenheit (°F)", value: "fahrenheit" },
];

const DISTANCE_UNITS = [
  { label: "Kilometers (km)", value: "km" },
  { label: "Miles (mi)", value: "mi" },
];

const CACHE_SIZES = [
  { label: "Small (50 MB)", value: "small" },
  { label: "Medium (200 MB)", value: "medium" },
  { label: "Large (500 MB)", value: "large" },
];

export function PreferencesManager({
  preferences,
  onPreferencesChange,
}: PreferencesManagerProps) {
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [weightUnitModalVisible, setWeightUnitModalVisible] = useState(false);
  const [temperatureUnitModalVisible, setTemperatureUnitModalVisible] =
    useState(false);
  const [distanceUnitModalVisible, setDistanceUnitModalVisible] =
    useState(false);
  const [cacheSizeModalVisible, setCacheSizeModalVisible] = useState(false);

  const updatePreference = (updates: Partial<UserPreferences>) => {
    const updated = { ...preferences, ...updates };
    onPreferencesChange(updated);
  };

  const updateUnits = (
    unitType: keyof UserPreferences["units"],
    value: any,
  ) => {
    const updated = {
      ...preferences,
      units: {
        ...preferences.units,
        [unitType]: value,
      },
    };
    onPreferencesChange(updated);
  };

  const updateNotifications = async (
    notifType: keyof UserPreferences["notifications"],
    value: boolean,
  ) => {
    // If enabling disaster alerts, request notification permissions
    if (notifType === "disasterAlerts" && value) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          "Permission Required",
          "Please enable notifications in your device settings to receive disaster alerts.",
          [{ text: "OK" }],
        );
        return;
      }
      // Sync with notification service
      await setNotificationsEnabled(true);
    } else if (notifType === "disasterAlerts" && !value) {
      // Disable notifications in service
      await setNotificationsEnabled(false);
    }

    const updated = {
      ...preferences,
      notifications: {
        ...preferences.notifications,
        [notifType]: value,
      },
    };
    onPreferencesChange(updated);
  };

  const updateOfflineSync = (
    syncType: keyof UserPreferences["offlineSync"],
    value: any,
  ) => {
    const updated = {
      ...preferences,
      offlineSync: {
        ...preferences.offlineSync,
        [syncType]: value,
      },
    };
    onPreferencesChange(updated);
  };

  const handleClearCache = () => {
    Alert.alert(
      "Clear Cache",
      "This will remove all cached data including images and analysis results. You can re-download them when online.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Cache",
          style: "destructive",
          onPress: async () => {
            try {
              // Clear specific cache keys
              const keys = await AsyncStorage.getAllKeys();
              const cacheKeys = keys.filter(
                (key) =>
                  key.startsWith("@cache/") ||
                  key.startsWith("@analysis/") ||
                  key.startsWith("@images/"),
              );
              await AsyncStorage.multiRemove(cacheKeys);
              Alert.alert("Success", "Cache cleared successfully");
            } catch (err) {
              console.error("Error clearing cache:", err);
              toastService.error("Failed to clear cache");
            }
          },
        },
      ],
    );
  };

  const getLanguageLabel = () => {
    const lang = LANGUAGES.find((l) => l.value === preferences.language);
    return lang?.label || "English";
  };

  const getWeightUnitLabel = () => {
    const unit = WEIGHT_UNITS.find((u) => u.value === preferences.units.weight);
    return unit?.label || "Kilograms (kg)";
  };

  const getTemperatureUnitLabel = () => {
    const unit = TEMPERATURE_UNITS.find(
      (u) => u.value === preferences.units.temperature,
    );
    return unit?.label || "Celsius (°C)";
  };

  const getDistanceUnitLabel = () => {
    const unit = DISTANCE_UNITS.find(
      (u) => u.value === preferences.units.distance,
    );
    return unit?.label || "Kilometers (km)";
  };

  const getCacheSizeLabel = () => {
    const size = CACHE_SIZES.find(
      (s) => s.value === preferences.offlineSync.cacheSize,
    );
    return size?.label || "Medium (200 MB)";
  };

  return (
    <View>
      {/* Language */}
      <SettingsSection title="Language">
        <PreferenceRow
          label="App Language"
          type="select"
          value={getLanguageLabel()}
          onPress={() => setLanguageModalVisible(true)}
        />
      </SettingsSection>

      {/* Units */}
      <SettingsSection title="Units">
        <PreferenceRow
          label="Weight"
          type="select"
          value={getWeightUnitLabel()}
          onPress={() => setWeightUnitModalVisible(true)}
        />
        <PreferenceRow
          label="Temperature"
          type="select"
          value={getTemperatureUnitLabel()}
          onPress={() => setTemperatureUnitModalVisible(true)}
        />
        <PreferenceRow
          label="Distance"
          type="select"
          value={getDistanceUnitLabel()}
          onPress={() => setDistanceUnitModalVisible(true)}
        />
      </SettingsSection>

      {/* Notifications */}
      <SettingsSection title="Notifications">
        <PreferenceRow
          label="Push Notifications"
          description="Receive notifications from the app"
          type="toggle"
          value={preferences.notifications.pushEnabled}
          onValueChange={(v) => updateNotifications("pushEnabled", v)}
        />
        <PreferenceRow
          label="Disaster Alerts"
          description="Get notified about weather warnings and disasters"
          type="toggle"
          value={preferences.notifications.disasterAlerts}
          onValueChange={(v) => updateNotifications("disasterAlerts", v)}
        />
        <PreferenceRow
          label="Analysis Complete"
          description="Notify when fish analysis is complete"
          type="toggle"
          value={preferences.notifications.analysisComplete}
          onValueChange={(v) => updateNotifications("analysisComplete", v)}
        />
        <PreferenceRow
          label="Chat Messages"
          description="Notify for new AI assistant messages"
          type="toggle"
          value={preferences.notifications.chatMessages}
          onValueChange={(v) => updateNotifications("chatMessages", v)}
        />
      </SettingsSection>

      {/* Offline Sync */}
      <SettingsSection title="Offline Sync">
        <PreferenceRow
          label="Auto Sync"
          description="Automatically sync data when online"
          type="toggle"
          value={preferences.offlineSync.autoSync}
          onValueChange={(v) => updateOfflineSync("autoSync", v)}
        />
        <PreferenceRow
          label="WiFi Only"
          description="Only sync when connected to WiFi"
          type="toggle"
          value={preferences.offlineSync.syncOnWifiOnly}
          onValueChange={(v) => updateOfflineSync("syncOnWifiOnly", v)}
        />
        <PreferenceRow
          label="Cache Size"
          type="select"
          value={getCacheSizeLabel()}
          onPress={() => setCacheSizeModalVisible(true)}
        />
        <PreferenceRow
          label="Clear Cache"
          description="Remove all cached data"
          type="action"
          onPress={handleClearCache}
          danger
        />
      </SettingsSection>

      {/* Language Modal */}
      <Modal
        visible={languageModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-bgCard rounded-t-2xl p-xl pb-3xl max-h-[70%]">
            <Text className="text-lg font-bold text-textPrimary mb-md">Select Language</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.value}
                  className={`flex-row justify-between items-center py-md border-b border-border ${preferences.language === lang.value ? "bg-primary/15 rounded-md px-sm" : ""}`}
                  onPress={() => {
                    updatePreference({ language: lang.value });
                    setLanguageModalVisible(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    className={`text-base ${preferences.language === lang.value ? "text-primaryLight font-bold" : "text-textSecondary"}`}
                  >
                    {lang.label}
                  </Text>
                  {preferences.language === lang.value && (
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
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-bgCard rounded-t-2xl p-xl pb-3xl max-h-[70%]">
            <Text className="text-lg font-bold text-textPrimary mb-md">Select Weight Unit</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {WEIGHT_UNITS.map((unit) => (
                <TouchableOpacity
                  key={unit.value}
                  className={`flex-row justify-between items-center py-md border-b border-border ${preferences.units.weight === unit.value ? "bg-primary/15 rounded-md px-sm" : ""}`}
                  onPress={() => {
                    updateUnits("weight", unit.value);
                    setWeightUnitModalVisible(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    className={`text-base ${preferences.units.weight === unit.value ? "text-primaryLight font-bold" : "text-textSecondary"}`}
                  >
                    {unit.label}
                  </Text>
                  {preferences.units.weight === unit.value && (
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

      {/* Temperature Unit Modal */}
      <Modal
        visible={temperatureUnitModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTemperatureUnitModalVisible(false)}
      >
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-bgCard rounded-t-2xl p-xl pb-3xl max-h-[70%]">
            <Text className="text-lg font-bold text-textPrimary mb-md">Select Temperature Unit</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {TEMPERATURE_UNITS.map((unit) => (
                <TouchableOpacity
                  key={unit.value}
                  className={`flex-row justify-between items-center py-md border-b border-border ${preferences.units.temperature === unit.value ? "bg-primary/15 rounded-md px-sm" : ""}`}
                  onPress={() => {
                    updateUnits("temperature", unit.value);
                    setTemperatureUnitModalVisible(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    className={`text-base ${preferences.units.temperature === unit.value ? "text-primaryLight font-bold" : "text-textSecondary"}`}
                  >
                    {unit.label}
                  </Text>
                  {preferences.units.temperature === unit.value && (
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

      {/* Distance Unit Modal */}
      <Modal
        visible={distanceUnitModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDistanceUnitModalVisible(false)}
      >
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-bgCard rounded-t-2xl p-xl pb-3xl max-h-[70%]">
            <Text className="text-lg font-bold text-textPrimary mb-md">Select Distance Unit</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {DISTANCE_UNITS.map((unit) => (
                <TouchableOpacity
                  key={unit.value}
                  className={`flex-row justify-between items-center py-md border-b border-border ${preferences.units.distance === unit.value ? "bg-primary/15 rounded-md px-sm" : ""}`}
                  onPress={() => {
                    updateUnits("distance", unit.value);
                    setDistanceUnitModalVisible(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    className={`text-base ${preferences.units.distance === unit.value ? "text-primaryLight font-bold" : "text-textSecondary"}`}
                  >
                    {unit.label}
                  </Text>
                  {preferences.units.distance === unit.value && (
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

      {/* Cache Size Modal */}
      <Modal
        visible={cacheSizeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCacheSizeModalVisible(false)}
      >
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-bgCard rounded-t-2xl p-xl pb-3xl max-h-[70%]">
            <Text className="text-lg font-bold text-textPrimary mb-md">Select Cache Size</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {CACHE_SIZES.map((size) => (
                <TouchableOpacity
                  key={size.value}
                  className={`flex-row justify-between items-center py-md border-b border-border ${preferences.offlineSync.cacheSize === size.value ? "bg-primary/15 rounded-md px-sm" : ""}`}
                  onPress={() => {
                    updateOfflineSync("cacheSize", size.value);
                    setCacheSizeModalVisible(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    className={`text-base ${preferences.offlineSync.cacheSize === size.value ? "text-primaryLight font-bold" : "text-textSecondary"}`}
                  >
                    {size.label}
                  </Text>
                  {preferences.offlineSync.cacheSize === size.value && (
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
    </View>
  );
}
