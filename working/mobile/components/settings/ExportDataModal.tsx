import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
} from "react-native";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
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
      <View style={styles.content}>
        <Text style={styles.description}>
          Export your catch history, analysis results, and chat conversations.
        </Text>

        {/* Export Options */}
        <View style={styles.optionsSection}>
          <Text style={styles.label}>What to Export</Text>
          <View style={styles.optionRow}>
            <View style={styles.optionLeft}>
              <Text style={styles.optionLabel}>Analyses</Text>
              <Text style={styles.optionDesc}>
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
          <View style={styles.optionRow}>
            <View style={styles.optionLeft}>
              <Text style={styles.optionLabel}>Chat History</Text>
              <Text style={styles.optionDesc}>
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

        <View style={styles.formatSection}>
          <Text style={styles.label}>Select Format</Text>
          <View style={styles.formatButtons}>
            <TouchableOpacity
              style={[
                styles.formatButton,
                format === "csv" && styles.formatButtonActive,
              ]}
              onPress={() => setFormat("csv")}
            >
              <Text
                style={[
                  styles.formatButtonText,
                  format === "csv" && styles.formatButtonTextActive,
                ]}
              >
                CSV
              </Text>
              <Text style={styles.formatButtonDesc}>Spreadsheet format</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.formatButton,
                format === "json" && styles.formatButtonActive,
              ]}
              onPress={() => setFormat("json")}
            >
              <Text
                style={[
                  styles.formatButtonText,
                  format === "json" && styles.formatButtonTextActive,
                ]}
              >
                JSON
              </Text>
              <Text style={styles.formatButtonDesc}>Raw data format</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            📦 Your data will be downloaded and you can share it via email,
            cloud storage, or other apps.
          </Text>
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onClose}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.exportButton,
              loading && styles.buttonDisabled,
            ]}
            onPress={handleExport}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.exportButtonText}>Export</Text>
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
  description: {
    fontSize: FONTS.sizes.sm,
    color: "#cbd5e1", // Brighter text
    lineHeight: 20,
  },
  optionsSection: {
    gap: SPACING.sm,
  },
  optionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  optionLeft: {
    flex: 1,
    marginRight: SPACING.md,
  },
  optionLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.medium,
  },
  optionDesc: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSubtle,
    marginTop: 2,
  },
  formatSection: {
    gap: SPACING.sm,
  },
  label: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.medium,
  },
  formatButtons: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  formatButton: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    alignItems: "center",
  },
  formatButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + "15",
  },
  formatButtonText: {
    fontSize: FONTS.sizes.sm,
    color: "#cbd5e1", // Brighter text
    fontWeight: FONTS.weights.bold,
    marginBottom: SPACING.xs,
  },
  formatButtonTextActive: {
    color: COLORS.primary,
  },
  formatButtonDesc: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSubtle,
  },
  infoBox: {
    backgroundColor: COLORS.primary + "10",
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  infoText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    lineHeight: 18,
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
  exportButton: {
    backgroundColor: COLORS.primary,
  },
  exportButtonText: {
    fontSize: FONTS.sizes.sm,
    color: "#fff",
    fontWeight: FONTS.weights.bold,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
