import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { COLORS } from "../../lib/constants";
import { Modal } from "../ui/Modal";
import { changePassword } from "../../lib/api-client";
import { toastService } from "../../lib/toast-service";

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({
  visible,
  onClose,
}: ChangePasswordModalProps) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!oldPassword) {
      newErrors.oldPassword = "Current password is required";
    }

    if (!newPassword) {
      newErrors.newPassword = "New password is required";
    } else if (newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters";
    }

    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      setLoading(true);
      await changePassword(oldPassword, newPassword);
      Alert.alert("Success", "Password changed successfully");
      handleClose();
    } catch (err) {
      console.error("Error changing password:", err);
      toastService.error(
        "Failed to change password. Please check your current password.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setErrors({});
    onClose();
  };

  return (
    <Modal visible={visible} onClose={handleClose} title="Change Password">
      <View className="gap-lg">
        <View className="gap-xs">
          <Text className="text-sm text-slate-300 font-medium">Current Password</Text>
          <TextInput
            className={`bg-slate-900 border border-slate-600 rounded-md px-md py-sm text-sm text-slate-100 ${errors.oldPassword ? "border-error" : ""}`}
            value={oldPassword}
            onChangeText={setOldPassword}
            placeholder="Enter current password"
            placeholderTextColor={COLORS.textSubtle}
            secureTextEntry
            autoCapitalize="none"
          />
          {errors.oldPassword && (
            <Text className="text-xs text-error mt-xs">{errors.oldPassword}</Text>
          )}
        </View>

        <View className="gap-xs">
          <Text className="text-sm text-slate-300 font-medium">New Password</Text>
          <TextInput
            className={`bg-slate-900 border border-slate-600 rounded-md px-md py-sm text-sm text-slate-100 ${errors.newPassword ? "border-error" : ""}`}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Enter new password"
            placeholderTextColor={COLORS.textSubtle}
            secureTextEntry
            autoCapitalize="none"
          />
          {errors.newPassword && (
            <Text className="text-xs text-error mt-xs">{errors.newPassword}</Text>
          )}
        </View>

        <View className="gap-xs">
          <Text className="text-sm text-slate-300 font-medium">Confirm New Password</Text>
          <TextInput
            className={`bg-slate-900 border border-slate-600 rounded-md px-md py-sm text-sm text-slate-100 ${errors.confirmPassword ? "border-error" : ""}`}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter new password"
            placeholderTextColor={COLORS.textSubtle}
            secureTextEntry
            autoCapitalize="none"
          />
          {errors.confirmPassword && (
            <Text className="text-xs text-error mt-xs">{errors.confirmPassword}</Text>
          )}
        </View>

        <View className="flex-row gap-md mt-md">
          <TouchableOpacity
            className="flex-1 py-sm rounded-md items-center justify-center bg-slate-900 border border-slate-600"
            onPress={handleClose}
            disabled={loading}
          >
            <Text className="text-sm text-slate-300 font-medium">Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 py-sm rounded-md items-center justify-center bg-primary ${loading ? "opacity-50" : ""}`}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-sm text-white font-bold">Change Password</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
