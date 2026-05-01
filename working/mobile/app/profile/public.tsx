import React, { useState, useEffect } from "react";
import {
  View,
  Text,
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
import { COLORS } from "../../lib/constants";

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
      <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
        <Stack.Screen
          options={{
            title: "Public Profile Preview",
            headerBackTitle: "Back",
          }}
        />
        <ScrollView style={{ flex: 1 }}>
          <SkeletonProfile />
        </ScrollView>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
        <Stack.Screen
          options={{
            title: "Public Profile Preview",
            headerBackTitle: "Back",
          }}
        />
        <View className="flex-1 items-center justify-center p-6">
          <Text className="mb-4 text-center text-[12px] text-[#ef4444]">
            {error || "Profile not found"}
          </Text>
          <Text
            className="text-[12px] font-semibold text-[#1e40af]"
            onPress={loadProfile}
          >
            Retry
          </Text>
        </View>
      </View>
    );
  }

  if (!profile.isPublic) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
        <Stack.Screen
          options={{
            title: "Public Profile Preview",
            headerBackTitle: "Back",
          }}
        />
        <View className="flex-1 items-center justify-center p-6">
          <Text className="mb-2 text-center text-[13px] text-[#f8fafc]">
            Your profile is currently private.
          </Text>
          <Text className="text-center text-[12px] text-[#94a3b8]">
            Enable public profile in settings to share it with others.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <Stack.Screen
        options={{
          title: "Public Profile Preview",
          headerBackTitle: "Back",
        }}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 24,
          paddingBottom: 64,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Preview Notice */}
        <Card
          className="mb-4"
          style={{
            backgroundColor: `${COLORS.primary}15`,
            borderColor: `${COLORS.primary}40`,
            borderWidth: 1,
          }}
        >
          <Text className="text-center text-[12px] text-[#1e40af]">
            👁️ This is how others will see your public profile
          </Text>
        </Card>

        {/* Profile Header */}
        <Card className="mb-4 items-center p-6">
          <View className="mb-4">
            <Avatar uri={profile.avatarUrl} name={profile.name} size="xl" />
          </View>
          <Text className="mb-1 text-[20px] font-bold text-[#f8fafc]">
            {profile.name}
          </Text>
          {profile.role && (
            <View className="my-2">
              <Badge label={profile.role} variant="info" />
            </View>
          )}
          {profile.port && (
            <View className="mt-1 flex-row items-center gap-1">
              <Ionicons
                name="location-sharp"
                size={12}
                color={COLORS.textMuted}
              />
              <Text className="text-[12px] text-[#e2e8f0]">
                {profile.port}
              </Text>
            </View>
          )}
          {profile.region && (
            <Text className="mt-1 text-[12px] text-[#94a3b8]">
              {profile.region}
            </Text>
          )}
        </Card>

        {/* Statistics Section */}
        {profile.showStats && profile.stats && (
          <Card className="mb-4 p-6">
            <Text className="mb-3 text-[13px] font-bold text-[#f8fafc]">
              Fishing Statistics
            </Text>
            <View className="mb-6 flex-row justify-around">
              <View className="flex-1 items-center">
                <Text className="text-[20px] font-bold text-[#1e40af]">
                  {profile.stats.totalCatches}
                </Text>
                <Text className="mt-1 text-center text-[10px] text-[#94a3b8]">
                  Total Catches
                </Text>
              </View>
              <View className="flex-1 items-center">
                <Text className="text-[20px] font-bold text-[#1e40af]">
                  {profile.stats.speciesCount}
                </Text>
                <Text className="mt-1 text-center text-[10px] text-[#94a3b8]">
                  Species Caught
                </Text>
              </View>
              <View className="flex-1 items-center">
                <Text className="text-[20px] font-bold text-[#1e40af]">
                  ₹{profile.stats.totalEarnings.toLocaleString()}
                </Text>
                <Text className="mt-1 text-center text-[10px] text-[#94a3b8]">
                  Total Earnings
                </Text>
              </View>
            </View>

            {/* Species Distribution */}
            {profile.stats.speciesDistribution &&
              Object.keys(profile.stats.speciesDistribution).length > 0 && (
                <View className="border-t border-[#334155] pt-4">
                  <Text className="mb-2 text-[13px] font-semibold text-[#e2e8f0]">
                    Top Species
                  </Text>
                  {Object.entries(profile.stats.speciesDistribution)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([species, count]) => (
                      <View
                        key={species}
                        className="flex-row items-center justify-between border-b border-[#334155] py-2"
                      >
                        <Text className="text-[12px] text-[#f8fafc]">
                          {species}
                        </Text>
                        <Text className="text-[12px] text-[#94a3b8]">
                          {count} catches
                        </Text>
                      </View>
                    ))}
                </View>
              )}
          </Card>
        )}

        {/* Member Since */}
        <Card className="mb-4 p-6">
          <Text className="mb-1 text-[12px] text-[#94a3b8]">Member Since</Text>
          <Text className="text-[12px] font-semibold text-[#f8fafc]">
            {new Date(profile.createdAt).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </Text>
        </Card>

        {/* Footer */}
        <View className="mt-4 items-center">
          <Text className="text-center text-[10px] text-[#64748b]">
            Powered by Matsya AI - AI for Bharat Fishermen
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
