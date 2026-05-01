import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
} from "react-native";
import { COLORS } from "../../lib/constants";
import { Modal } from "../ui/Modal";
import { ExportService } from "../../lib/export-service";
import type { DataExportOptions } from "../../lib/types";
import { toastService } from "../../lib/toast-service";

interface ExportDataModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ExportDataModal({ visible, onClose }: ExportDataModalProps) {
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [includeAnalysis, setIncludeAnalysis] = useState(true);
  const [includeChat, setIncludeChat] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    try {
      setLoading(true);

      const options: DataExportOptions = {
        format,
        includeAnalysis,
        includeChat,
      };

      await ExportService.exportData(options);
      Alert.alert("Success", "Data exported successfully");
      onClose();
    } catch (err) {
      console.error("Error exporting data:", err);
      toastService.error("Failed to export data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} title="Export Data">
      <View className="gap-lg">
        <Text className="text-sm text-slate-300 leading-5">
          Export your catch history, analysis results, and chat conversations.
        </Text>

        {/* Export Options */}
        <View className="gap-sm">
          <Text className="text-sm text-textSecondary font-medium">What to Export</Text>
          <View className="flex-row justify-between items-center py-sm border-b border-border">
            <View className="flex-1 mr-md">
              <Text className="text-sm text-textSecondary font-medium">Analyses</Text>
              <Text className="text-xs text-textSubtle mt-[2px]">
                All catch analysis results and images
              </Text>
            </View>
            <Switch
              value={includeAnalysis}
              onValueChange={setIncludeAnalysis}
              trackColor={{ false: COLORS.border, true: COLORS.primary + "80" }}
              thumbColor={includeAnalysis ? COLORS.primary : COLORS.textSubtle}
            />
          </View>
          <View className="flex-row justify-between items-center py-sm border-b border-border">
            <View className="flex-1 mr-md">
              <Text className="text-sm text-textSecondary font-medium">Chat History</Text>
              <Text className="text-xs text-textSubtle mt-[2px]">
                All conversations with AI assistant
              </Text>
            </View>
            <Switch
              value={includeChat}
              onValueChange={setIncludeChat}
              trackColor={{ false: COLORS.border, true: COLORS.primary + "80" }}
              thumbColor={includeChat ? COLORS.primary : COLORS.textSubtle}
            />
          </View>
        </View>

        <View className="gap-sm">
          <Text className="text-sm text-textSecondary font-medium">Select Format</Text>
          <View className="flex-row gap-md">
            <TouchableOpacity
              className={`flex-1 bg-bgDark border-2 rounded-md p-sm items-center ${format === "csv" ? "border-primary bg-primary/15" : "border-border"}`}
              onPress={() => setFormat("csv")}
            >
              <Text className={`text-sm font-bold mb-xs ${format === "csv" ? "text-primary" : "text-slate-300"}`}>
                CSV
              </Text>
              <Text className="text-xs text-textSubtle">Spreadsheet format</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`flex-1 bg-bgDark border-2 rounded-md p-sm items-center ${format === "json" ? "border-primary bg-primary/15" : "border-border"}`}
              onPress={() => setFormat("json")}
            >
              <Text className={`text-sm font-bold mb-xs ${format === "json" ? "text-primary" : "text-slate-300"}`}>
                JSON
              </Text>
              <Text className="text-xs text-textSubtle">Raw data format</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="bg-primary/10 border-l-[3px] border-primary rounded-md p-md">
          <Text className="text-xs text-textMuted leading-[18px]">
            📦 Your data will be downloaded and you can share it via email,
            cloud storage, or other apps.
          </Text>
        </View>

        <View className="flex-row gap-md mt-md">
          <TouchableOpacity
            className="flex-1 py-sm rounded-md items-center justify-center bg-slate-900 border border-slate-600"
            onPress={onClose}
            disabled={loading}
          >
            <Text className="text-sm text-slate-300 font-medium">Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 py-sm rounded-md items-center justify-center bg-primary ${loading ? "opacity-50" : ""}`}
            onPress={handleExport}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-sm text-white font-bold">Export</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
