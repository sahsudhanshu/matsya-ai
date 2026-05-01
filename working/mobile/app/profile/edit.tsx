import React, { useState, useEffect } from "react";
import { View, Text, Alert } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Stack, router } from "expo-router";
import { ProfileForm } from "../../components/profile/ProfileForm";
import { AvatarUploader } from "../../components/profile/AvatarUploader";
import { ProfileService } from "../../lib/profile-service";
import { SkeletonProfile } from "../../components/ui/Skeleton";
import type { UserProfile } from "../../lib/types";
import { COLORS } from "../../lib/constants";

export default function EditProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await ProfileService.getProfile(true);
        if (isMounted) {
          if (data) {
            setProfile(data);
          } else {
            setError("Failed to load profile");
          }
        }
      } catch (err) {
        console.error("Error loading profile:", err);
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load profile",
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async (updates: Partial<UserProfile>) => {
    try {
      const updatedProfile = await ProfileService.updateProfile(updates);
      setProfile(updatedProfile);
      Alert.alert("Success", "Profile updated successfully", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err) {
      throw err; // Let ProfileForm handle the error
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const handleAvatarUploadComplete = (uri: string) => {
    if (profile) {
      setProfile({ ...profile, avatar: uri });
    }
  };

  const handleAvatarRemove = () => {
    if (profile) {
      setProfile({ ...profile, avatar: undefined });
    }
  };

  const handleAvatarUploadError = (error: Error) => {
    Alert.alert("Upload Error", error.message);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
        <Stack.Screen
          options={{
            title: "Edit Profile",
            headerBackTitle: "Back",
          }}
        />
        <KeyboardAwareScrollView style={{ flex: 1 }}>
          <SkeletonProfile />
        </KeyboardAwareScrollView>
      </View>
    );
  }

  if (error || !profile) {
    const handleRetry = () => {
      setLoading(true);
      setError(null);

      ProfileService.getProfile(true)
        .then((data) => {
          if (data) {
            setProfile(data);
          } else {
            setError("Failed to load profile");
          }
        })
        .catch((err) => {
          console.error("Error loading profile:", err);
          setError(
            err instanceof Error ? err.message : "Failed to load profile",
          );
        })
        .finally(() => {
          setLoading(false);
        });
    };

    return (
      <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
        <Stack.Screen
          options={{
            title: "Edit Profile",
            headerBackTitle: "Back",
          }}
        />
        <View className="flex-1 items-center justify-center p-6">
          <Text className="mb-4 text-center text-[12px] text-[#ef4444]">
            {error || "Profile not found"}
          </Text>
          <Text
            className="text-[12px] font-semibold text-[#1e40af]"
            onPress={handleRetry}
          >
            Retry
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <Stack.Screen
        options={{
          title: "Edit Profile",
          headerBackTitle: "Back",
        }}
      />

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
      >
        <View className="items-center border-b border-[#334155] bg-[#1e293b] px-6 py-6">
          <AvatarUploader
            currentUri={profile.avatar}
            userName={profile.name || "User"}
            onUploadComplete={handleAvatarUploadComplete}
            onRemove={handleAvatarRemove}
            onUploadError={handleAvatarUploadError}
          />
        </View>

        <ProfileForm
          initialValues={profile}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </KeyboardAwareScrollView>
    </View>
  );
}
