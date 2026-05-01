import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../lib/constants";
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
      <View className="gap-lg">
        <View className="bg-error/15 border-2 border-error/40 rounded-md p-md items-center">
          <Ionicons name="warning" size={48} color={COLORS.error} />
          <Text className="text-sm text-error font-bold text-center">
            This action is permanent and irreversible
          </Text>
        </View>

        <Text className="text-sm text-slate-300 leading-5">
          Deleting your account will permanently remove:
        </Text>

        <View className="gap-sm pl-sm">
          <Text className="text-sm text-slate-200 leading-5">
            • Your profile and personal information
          </Text>
          <Text className="text-sm text-slate-200 leading-5">
            • All catch history and analysis results
          </Text>
          <Text className="text-sm text-slate-200 leading-5">
            • Chat conversations with the AI assistant
          </Text>
          <Text className="text-sm text-slate-200 leading-5">
            • All associated data and settings
          </Text>
        </View>

        <Text className="text-sm text-slate-300 mt-md">
          Type <Text className="font-bold text-error font-mono">DELETE</Text> to confirm:
        </Text>

        <TextInput
          className="bg-slate-900 border-2 border-slate-600 rounded-md px-md py-sm text-sm text-slate-100 font-mono"
          value={confirmText}
          onChangeText={setConfirmText}
          placeholder="Type DELETE here"
          placeholderTextColor={COLORS.textSubtle}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <View className="flex-row gap-md mt-md">
          <TouchableOpacity
            className="flex-1 py-sm rounded-md items-center justify-center bg-slate-900 border border-slate-600"
            onPress={handleClose}
            disabled={loading}
          >
            <Text className="text-sm text-slate-300 font-medium">Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 py-sm rounded-md items-center justify-center bg-error ${(!isConfirmValid || loading) ? "opacity-50" : ""}`}
            onPress={handleConfirm}
            disabled={!isConfirmValid || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-sm text-white font-bold">Delete Account</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
