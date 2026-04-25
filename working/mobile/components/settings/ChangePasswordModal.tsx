import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
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
      <View style={styles.content}>
        <View style={styles.field}>
          <Text style={styles.label}>Current Password</Text>
          <TextInput
            style={[styles.input, errors.oldPassword && styles.inputError]}
            value={oldPassword}
            onChangeText={setOldPassword}
            placeholder="Enter current password"
            placeholderTextColor={COLORS.textSubtle}
            secureTextEntry
            autoCapitalize="none"
          />
          {errors.oldPassword && (
            <Text style={styles.errorText}>{errors.oldPassword}</Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>New Password</Text>
          <TextInput
            style={[styles.input, errors.newPassword && styles.inputError]}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Enter new password"
            placeholderTextColor={COLORS.textSubtle}
            secureTextEntry
            autoCapitalize="none"
          />
          {errors.newPassword && (
            <Text style={styles.errorText}>{errors.newPassword}</Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Confirm New Password</Text>
          <TextInput
            style={[styles.input, errors.confirmPassword && styles.inputError]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter new password"
            placeholderTextColor={COLORS.textSubtle}
            secureTextEntry
            autoCapitalize="none"
          />
          {errors.confirmPassword && (
            <Text style={styles.errorText}>{errors.confirmPassword}</Text>
          )}
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleClose}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.submitButton,
              loading && styles.buttonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Change Password</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: SPACING.lg,
  },
  field: {
    gap: SPACING.xs,
  },
  label: {
    fontSize: FONTS.sizes.sm,
    color: "#cbd5e1", // Brighter label text
    fontWeight: FONTS.weights.medium,
  },
  input: {
    backgroundColor: "#0f172a", // Darker input for contrast
    borderWidth: 1,
    borderColor: "#475569", // Lighter border
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONTS.sizes.sm,
    color: "#f1f5f9", // Brighter text
  },
  inputError: {
    borderColor: COLORS.error,
  },
  errorText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
  buttons: {
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  button: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#0f172a", // Darker for contrast
    borderWidth: 1,
    borderColor: "#475569", // Lighter border
  },
  cancelButtonText: {
    fontSize: FONTS.sizes.sm,
    color: "#cbd5e1", // Brighter text
    fontWeight: FONTS.weights.medium,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
  },
  submitButtonText: {
    fontSize: FONTS.sizes.sm,
    color: "#fff",
    fontWeight: FONTS.weights.bold,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
