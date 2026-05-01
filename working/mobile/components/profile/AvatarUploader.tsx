import React, { useState } from "react";
import { View, Text, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { toastService } from "../../lib/toast-service";
import { Avatar } from "../ui/Avatar";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { AvatarService } from "../../lib/avatar-service";
import { COLORS } from "../../lib/constants";

interface AvatarUploaderProps {
  currentUri?: string;
  userName?: string;
  onUploadComplete: (uri: string) => void;
  onRemove?: () => void;
  onUploadError: (error: Error) => void;
}

export function AvatarUploader({
  currentUri,
  userName = "User",
  onUploadComplete,
  onRemove,
  onUploadError,
}: AvatarUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const handleAvatarPress = () => {
    setShowModal(true);
  };

  const handleRemoveAvatar = () => {
    Alert.alert(
      "Remove Profile Photo",
      "Are you sure you want to remove your profile photo?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setShowModal(false);
              await AvatarService.removeAvatar();
              if (onRemove) {
                onRemove();
              }
              toastService.success("Profile photo removed successfully!");
            } catch (error) {
              toastService.error("Failed to remove profile photo.");
              onUploadError(error as Error);
            }
          },
        },
      ],
    );
  };

  const handlePickImage = async (source: "camera" | "library") => {
    try {
      setShowModal(false);
      const imageUri = await AvatarService.pickImage(source);
      if (imageUri) {
        setPreviewUri(imageUri);
        setShowModal(true);
      }
    } catch (error) {
      if (error instanceof Error && error.message === "Permission denied") {
        toastService.error(
          `${source === "camera" ? "Camera" : "Photo library"} permission is required.`,
        );
      } else {
        onUploadError(error as Error);
      }
    }
  };

  const handleUpload = async () => {
    if (!previewUri) return;

    try {
      setUploading(true);
      setUploadProgress(0);

      const avatarUrl = await AvatarService.uploadAvatar(
        previewUri,
        (progress) => setUploadProgress(progress),
      );

      setUploading(false);
      setPreviewUri(null);
      setShowModal(false);
      onUploadComplete(avatarUrl);
      toastService.success("Profile photo updated successfully!");
    } catch (error) {
      setUploading(false);
      toastService.error("Failed to upload profile photo. Please try again.");
      onUploadError(error as Error);
      setPreviewUri(null);
      setShowModal(false);
    }
  };

  const handleCancel = () => {
    setPreviewUri(null);
    setShowModal(false);
    setUploadProgress(0);
  };

  return (
    <>
      <Avatar
        uri={currentUri}
        name={userName}
        size="xl"
        editable
        onPress={handleAvatarPress}
        loading={uploading}
      />

      <Modal
        visible={showModal}
        onClose={handleCancel}
        title={previewUri ? "Preview" : "Choose Photo"}
        size="sm"
      >
        {previewUri ? (
          <View className="items-center">
            <Avatar uri={previewUri} name={userName} size="xl" />

            {uploading && (
              <View className="mt-6 items-center">
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text className="mt-2 text-[12px] text-[#e2e8f0]">
                  Uploading... {uploadProgress}%
                </Text>
              </View>
            )}

            <View className="mt-8 w-full flex-row gap-4">
              <Button
                label="Cancel"
                onPress={handleCancel}
                variant="outline"
                disabled={uploading}
                className="flex-1"
              />
              <Button
                label="Upload"
                onPress={handleUpload}
                disabled={uploading}
                className="flex-1"
              />
            </View>
          </View>
        ) : (
          <View className="gap-2 py-2">
            <Text className="mb-1 text-center text-[12px] font-semibold text-[#f8fafc]">
              Choose Photo Source
            </Text>
            <Button
              label="Take Photo"
              onPress={() => handlePickImage("camera")}
              variant="primary"
              icon={<Ionicons name="camera" size={20} color="#fff" />}
              iconPosition="left"
              className="w-full min-h-[44px]"
              fullWidth
            />
            <Button
              label="Choose from Gallery"
              onPress={() => handlePickImage("library")}
              variant="outline"
              icon={
                <Ionicons name="images" size={20} color={COLORS.primaryLight} />
              }
              iconPosition="left"
              className="w-full min-h-[44px]"
              fullWidth
            />
            {currentUri && onRemove && (
              <Button
                label="Remove Photo"
                onPress={handleRemoveAvatar}
                variant="outline"
                icon={
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={COLORS.danger}
                  />
                }
                iconPosition="left"
                className="mt-4 w-full min-h-[44px] border-[#ef4444]"
                fullWidth
              />
            )}
          </View>
        )}
      </Modal>
    </>
  );
}
