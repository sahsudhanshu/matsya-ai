import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Stack, router } from "expo-router";
import { ProfileForm } from "../../components/profile/ProfileForm";
import { AvatarUploader } from "../../components/profile/AvatarUploader";
import { ProfileService } from "../../lib/profile-service";
import { SkeletonProfile } from "../../components/ui/Skeleton";
import type { UserProfile } from "../../lib/types";
import { COLORS, FONTS, SPACING } from "../../lib/constants";

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
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: "Edit Profile",
            headerBackTitle: "Back",
          }}
        />
        <KeyboardAwareScrollView style={styles.scroll}>
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
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: "Edit Profile",
            headerBackTitle: "Back",
          }}
        />
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || "Profile not found"}</Text>
          <Text style={styles.retryButton} onPress={handleRetry}>
            Retry
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Edit Profile",
          headerBackTitle: "Back",
        }}
      />

      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
      >
        <View style={styles.avatarSection}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
  },
  scroll: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
  avatarSection: {
    alignItems: "center",
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
});
