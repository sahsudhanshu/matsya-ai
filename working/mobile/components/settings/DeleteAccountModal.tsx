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
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import { Modal } from "../ui/Modal";
import { deleteUserAccount } from "../../lib/api-client";
import { toastService } from "../../lib/toast-service";

interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteAccountModal({
  visible,
  onClose,
  onConfirm,
}: DeleteAccountModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  const isConfirmValid = confirmText === "DELETE";

  const handleConfirm = async () => {
    if (!isConfirmValid) return;

    try {
      setLoading(true);
      await deleteUserAccount();
      await onConfirm();
    } catch (err) {
      console.error("Error deleting account:", err);
      toastService.error("Failed to delete account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setConfirmText("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      onClose={handleClose}
      title="Delete Account"
      size="lg"
    >
      <View style={styles.content}>
        <View style={styles.warningBox}>
          <Ionicons name="warning" size={48} color={COLORS.error} />
          <Text style={styles.warningTitle}>
            This action is permanent and irreversible
          </Text>
        </View>

        <Text style={styles.description}>
          Deleting your account will permanently remove:
        </Text>

        <View style={styles.list}>
          <Text style={styles.listItem}>
            • Your profile and personal information
          </Text>
          <Text style={styles.listItem}>
            • All catch history and analysis results
          </Text>
          <Text style={styles.listItem}>
            • Chat conversations with the AI assistant
          </Text>
          <Text style={styles.listItem}>
            • All associated data and settings
          </Text>
        </View>

        <Text style={styles.confirmLabel}>
          Type <Text style={styles.deleteText}>DELETE</Text> to confirm:
        </Text>

        <TextInput
          style={styles.input}
          value={confirmText}
          onChangeText={setConfirmText}
          placeholder="Type DELETE here"
          placeholderTextColor={COLORS.textSubtle}
          autoCapitalize="characters"
          autoCorrect={false}
        />

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
              styles.deleteButton,
              (!isConfirmValid || loading) && styles.buttonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!isConfirmValid || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.deleteButtonText}>Delete Account</Text>
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
  warningBox: {
    backgroundColor: COLORS.error + "15",
    borderWidth: 2,
    borderColor: COLORS.error + "40",
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: "center",
  },
  warningIcon: {
    fontSize: 24,
    marginBottom: SPACING.xs,
  },
  warningTitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.error,
    fontWeight: FONTS.weights.bold,
    textAlign: "center",
  },
  description: {
    fontSize: FONTS.sizes.sm,
    color: "#cbd5e1", // Brighter text
    lineHeight: 20,
  },
  list: {
    gap: SPACING.sm,
    paddingLeft: SPACING.sm,
  },
  listItem: {
    fontSize: FONTS.sizes.sm,
    color: "#e2e8f0", // Brighter text
    lineHeight: 20,
  },
  confirmLabel: {
    fontSize: FONTS.sizes.sm,
    color: "#cbd5e1", // Brighter text
    marginTop: SPACING.md,
  },
  deleteText: {
    fontWeight: FONTS.weights.bold,
    color: COLORS.error,
    fontFamily: "monospace",
  },
  input: {
    backgroundColor: "#0f172a",
    borderWidth: 2,
    borderColor: "#475569",
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONTS.sizes.sm,
    color: "#f1f5f9",
    fontFamily: "monospace",
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
  deleteButton: {
    backgroundColor: COLORS.error,
  },
  deleteButtonText: {
    fontSize: FONTS.sizes.sm,
    color: "#fff",
    fontWeight: FONTS.weights.bold,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
