import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Modal,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { COLORS } from "../../lib/constants";
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
      className="flex-row items-center bg-bgCard rounded-lg p-md mb-sm border border-borderDark gap-md"
      onPress={() => handleSelect(item)}
      activeOpacity={0.7}
    >
      <View className="relative">
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} className="w-[50px] h-[50px] rounded-md bg-bgDark" />
        ) : (
          <View className="w-[50px] h-[50px] rounded-md bg-bgDark justify-center items-center">
            <Ionicons name="fish" size={32} color={COLORS.textMuted} />
          </View>
        )}
        {item.type === "group" && (
          <View className="absolute top-[-4px] right-[-4px] bg-primary rounded-full px-[6px] py-[2px] flex-row items-center gap-[2px]">
            <Ionicons name="images" size={12} color="#fff" />
            <Text className="text-white text-[10px] font-bold">{item.imageCount}</Text>
          </View>
        )}
      </View>
      <View className="flex-1">
        <Text className="text-[12px] font-semibold text-textPrimary mb-[2px]" numberOfLines={1}>
          {item.type === "single"
            ? item.species || "Unknown Species"
            : item.groupName}
        </Text>
        <Text className="text-[10px] text-textMuted">{formatDate(item.date)}</Text>
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
      <View className="flex-1 bg-[rgba(0,0,0,0.5)] justify-end">
        <View className="bg-bgDark rounded-t-2xl max-h-[80%] pb-xl">
          {/* Header */}
          <View className="flex-row justify-between items-center p-lg border-b border-borderDark">
            <View className="flex-row items-center gap-sm">
              <Ionicons name="images" size={24} color={COLORS.primaryLight} />
              <Text className="text-[13px] font-bold text-textPrimary">Reference a Catch</Text>
            </View>
            <TouchableOpacity onPress={onClose} className="p-xs">
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View className="flex-row items-center bg-bgCard rounded-xl px-md py-sm m-lg border border-borderDark gap-sm">
            <Ionicons name="search" size={20} color={COLORS.textMuted} />
            <TextInput
              className="flex-1 text-textPrimary text-[12px] py-xs"
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
            <View className="flex-1 justify-center items-center p-xl min-h-[300px]">
              <ActivityIndicator size="large" color={COLORS.primaryLight} />
              <Text className="mt-md text-[12px] text-textMuted">Loading analyses...</Text>
            </View>
          ) : error ? (
            <View className="flex-1 justify-center items-center p-xl min-h-[300px]">
              <Ionicons name="alert-circle" size={48} color={COLORS.error} />
              <Text className="mt-md text-[12px] text-error text-center">{error}</Text>
              <TouchableOpacity
                className="mt-lg bg-primary px-lg py-sm rounded-lg"
                onPress={loadAnalyses}
              >
                <Text className="text-white text-[12px] font-semibold">Retry</Text>
              </TouchableOpacity>
            </View>
          ) : filteredAnalyses.length === 0 ? (
            <View className="flex-1 justify-center items-center p-xl min-h-[300px]">
              <Ionicons
                name="fish-outline"
                size={48}
                color={COLORS.textMuted}
              />
              <Text className="mt-md text-[13px] font-bold text-textPrimary">
                {searchQuery ? "No matches found" : "No analyses yet"}
              </Text>
              <Text className="mt-xs text-[12px] text-textMuted text-center leading-[20px]">
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
              contentContainerClassName="px-lg pb-lg"
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
