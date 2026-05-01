import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  Alert,
  Clipboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "../ui/Avatar";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { COLORS } from "../../lib/constants";
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
    <Card className="p-6">
      {/* Profile Preview */}
      <View className="mb-6 flex-row items-center border-b border-[#334155] pb-6">
        <Avatar uri={profile.avatarUrl} name={profile.name} size="lg" />
        <View className="ml-4 flex-1">
          <Text className="text-[13px] font-bold text-[#f8fafc]">
            {profile.name}
          </Text>
          {profile.role && (
            <Text className="mt-1 text-[12px] text-[#e2e8f0]">
              {profile.role}
            </Text>
          )}
          {profile.port && (
            <View className="mt-1 flex-row items-center gap-1">
              <Ionicons
                name="location"
                size={14}
                color={COLORS.textSecondary}
              />
              <Text className="text-[10px] text-[#94a3b8]">
                {profile.port}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Public Profile Toggle */}
      <View className="flex-row items-center justify-between py-2">
        <View className="mr-4 flex-1">
          <Text className="text-[12px] font-semibold text-[#f8fafc]">
            Public Profile
          </Text>
          <Text className="mt-1 text-[10px] text-[#94a3b8]">
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
        <View className="mt-4 flex-row items-start gap-2 rounded-xl bg-[#334155] p-4">
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={COLORS.primary}
          />
          <Text className="flex-1 text-[12px] leading-5 text-[#e2e8f0]">
            Public profile is off. Turn it on to share your fishing profile with
            others.
          </Text>
        </View>
      )}

      {profile.isPublic && (
        <>
          {/* Show Statistics Toggle */}
          <View className="flex-row items-center justify-between border-t border-[#334155] py-2">
            <View className="mr-4 flex-1">
              <Text className="text-[12px] font-semibold text-[#f8fafc]">
                Show Fishing Statistics
              </Text>
              <Text className="mt-1 text-[10px] text-[#94a3b8]">
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
            <View className="mt-4 rounded-xl bg-[#0f172a] p-4">
              <Text className="mb-3 text-[12px] font-semibold text-[#e2e8f0]">
                Public Statistics
              </Text>
              <View className="flex-row justify-around">
                <View className="items-center">
                  <Text className="text-[20px] font-bold text-[#1e40af]">
                    {profile.stats.totalCatches}
                  </Text>
                  <Text className="mt-1 text-[10px] text-[#94a3b8]">
                    Total Catches
                  </Text>
                </View>
                <View className="items-center">
                  <Text className="text-[20px] font-bold text-[#1e40af]">
                    {profile.stats.speciesCount}
                  </Text>
                  <Text className="mt-1 text-[10px] text-[#94a3b8]">
                    Species
                  </Text>
                </View>
                <View className="items-center">
                  <Text className="text-[20px] font-bold text-[#1e40af]">
                    ₹{profile.stats.totalEarnings.toLocaleString()}
                  </Text>
                  <Text className="mt-1 text-[10px] text-[#94a3b8]">
                    Earnings
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Public URL */}
          <View className="mt-4">
            <Text className="mb-2 text-[12px] font-semibold text-[#e2e8f0]">
              Your Public Profile URL
            </Text>
            <View className="rounded-xl border border-[#334155] bg-[#334155] p-3">
              <Text className="text-[12px] text-[#3b82f6]" numberOfLines={1}>
                {publicUrl}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="mt-4 gap-3">
            <Button
              label="Copy URL"
              onPress={handleCopyUrl}
              variant="outline"
              className="w-full"
              disabled={loading}
            />
            <Button
              label="Share Profile"
              onPress={onShare}
              variant="outline"
              className="w-full"
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
