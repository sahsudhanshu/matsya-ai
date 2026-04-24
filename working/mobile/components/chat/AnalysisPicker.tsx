import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Modal,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import { getImages, getGroups } from "../../lib/api-client";
import type { ImageRecord, GroupRecord } from "../../lib/api-client";
import { toastService } from "../../lib/toast-service";

interface AnalysisPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectAnalysis: (
    analysisId: string,
    imageUrl: string,
    species?: string,
  ) => void;
  onSelectGroup: (groupId: string, groupName: string) => void;
}

type AnalysisItem = {
  id: string;
  type: "single" | "group";
  imageUrl: string;
  species?: string;
  date: string;
  groupName?: string;
  imageCount?: number;
};

export function AnalysisPicker({
  visible,
  onClose,
  onSelectAnalysis,
  onSelectGroup,
}: AnalysisPickerProps) {
  const [analyses, setAnalyses] = useState<AnalysisItem[]>([]);
  const [filteredAnalyses, setFilteredAnalyses] = useState<AnalysisItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadAnalyses();
    }
  }, [visible]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredAnalyses(analyses);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = analyses.filter((item) => {
        if (item.type === "single" && item.species) {
          return item.species.toLowerCase().includes(query);
        }
        if (item.type === "group" && item.groupName) {
          return item.groupName.toLowerCase().includes(query);
        }
        return false;
      });
      setFilteredAnalyses(filtered);
    }
  }, [searchQuery, analyses]);

  const loadAnalyses = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Load both single analyses and groups
      const [imagesResponse, groupsResponse] = await Promise.all([
        getImages(20),
        getGroups(20),
      ]);

      const singleAnalyses: AnalysisItem[] = (imagesResponse.items || [])
        .filter((img) => img.status === "completed" && img.analysisResult)
        .map((img) => ({
          id: img.imageId,
          type: "single" as const,
          imageUrl: img.s3Path,
          species: img.analysisResult?.species,
          date: img.createdAt,
        }));

      const groupAnalyses: AnalysisItem[] = (groupsResponse.groups || [])
        .filter((group) => group.status === "completed" && group.analysisResult)
        .map((group) => ({
          id: group.groupId,
          type: "group" as const,
          imageUrl: group.presignedViewUrls?.[0] || "",
          groupName: `Group of ${group.imageCount} fish`,
          imageCount: group.imageCount,
          date: group.createdAt,
        }));

      const combined = [...singleAnalyses, ...groupAnalyses].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      setAnalyses(combined);
      setFilteredAnalyses(combined);
    } catch (err) {
      console.error("Failed to load analyses:", err);
      toastService.error("Failed to load analyses. Please try again.");
      setError("Failed to load analyses. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (item: AnalysisItem) => {
    if (item.type === "single") {
      onSelectAnalysis(item.id, item.imageUrl, item.species);
    } else {
      onSelectGroup(item.id, item.groupName || "Group");
    }
    onClose();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
    });
  };

  const renderItem = ({ item }: { item: AnalysisItem }) => (
    <TouchableOpacity
      style={styles.analysisItem}
      onPress={() => handleSelect(item)}
      activeOpacity={0.7}
    >
      <View style={styles.imageContainer}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.thumbnail, styles.placeholderImage]}>
            <Ionicons name="fish" size={32} color={COLORS.textMuted} />
          </View>
        )}
        {item.type === "group" && (
          <View style={styles.groupBadge}>
            <Ionicons name="images" size={12} color="#fff" />
            <Text style={styles.groupBadgeText}>{item.imageCount}</Text>
          </View>
        )}
      </View>
      <View style={styles.analysisInfo}>
        <Text style={styles.analysisTitle} numberOfLines={1}>
          {item.type === "single"
            ? item.species || "Unknown Species"
            : item.groupName}
        </Text>
        <Text style={styles.analysisDate}>{formatDate(item.date)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="images" size={24} color={COLORS.primaryLight} />
              <Text style={styles.headerTitle}>Reference a Catch</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by species or group..."
              placeholderTextColor={COLORS.textSubtle}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Content */}
          {isLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={COLORS.primaryLight} />
              <Text style={styles.loadingText}>Loading analyses...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerContainer}>
              <Ionicons name="alert-circle" size={48} color={COLORS.error} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={loadAnalyses}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : filteredAnalyses.length === 0 ? (
            <View style={styles.centerContainer}>
              <Ionicons
                name="fish-outline"
                size={48}
                color={COLORS.textMuted}
              />
              <Text style={styles.emptyTitle}>
                {searchQuery ? "No matches found" : "No analyses yet"}
              </Text>
              <Text style={styles.emptyText}>
                {searchQuery
                  ? "Try a different search term"
                  : "Upload and analyze a catch to reference it in chat"}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredAnalyses}
              renderItem={renderItem}
              keyExtractor={(item) => `${item.type}-${item.id}`}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.bgDark,
    borderTopLeftRadius: RADIUS["2xl"],
    borderTopRightRadius: RADIUS["2xl"],
    maxHeight: "80%",
    paddingBottom: SPACING.xl,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    margin: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.sm,
    paddingVertical: SPACING.xs,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  analysisItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
  },
  imageContainer: {
    position: "relative",
  },
  thumbnail: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgDark,
  },
  placeholderImage: {
    justifyContent: "center",
    alignItems: "center",
  },
  groupBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  groupBadgeText: {
    color: "#fff",
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
  },
  analysisInfo: {
    flex: 1,
  },
  analysisTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  analysisDate: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.xl,
    minHeight: 300,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
  },
  errorText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.sm,
    color: COLORS.error,
    textAlign: "center",
  },
  retryButton: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
  },
  emptyTitle: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  emptyText: {
    marginTop: SPACING.xs,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
});
