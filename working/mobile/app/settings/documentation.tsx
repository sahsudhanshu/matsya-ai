import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Markdown from "react-native-markdown-display";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import { Card } from "../../components/ui/Card";

// Import documentation content
const docsData = require("../../assets/docs/documentation.json");

interface DocSection {
  id: string;
  title: string;
  icon: string;
  content: string;
}

export default function DocumentationScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  const sections: DocSection[] = docsData.sections;

  // Filter sections based on search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;

    const query = searchQuery.toLowerCase();
    return sections.filter(
      (section) =>
        section.title.toLowerCase().includes(query) ||
        section.content.toLowerCase().includes(query),
    );
  }, [searchQuery, sections]);

  const handleSectionPress = (sectionId: string) => {
    if (selectedSection === sectionId) {
      setSelectedSection(null);
    } else {
      setSelectedSection(sectionId);
    }
  };

  const renderSectionItem = ({ item }: { item: DocSection }) => {
    const isExpanded = selectedSection === item.id;

    return (
      <Card padding={0} className="mb-4 overflow-hidden">
        <TouchableOpacity
          className="flex-row items-center justify-between p-6"
          onPress={() => handleSectionPress(item.id)}
          activeOpacity={0.7}
        >
          <View className="flex-1 flex-row items-center gap-4">
            <View className="h-[34px] w-[34px] items-center justify-center rounded-[12px] bg-[#1e40af20]">
              <Ionicons
                name={item.icon as any}
                size={24}
                color={COLORS.primary}
              />
            </View>
            <Text className="flex-1 text-[13px] font-semibold text-[#f8fafc]">{item.title}</Text>
          </View>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={COLORS.textMuted}
          />
        </TouchableOpacity>

        {isExpanded && (
          <View className="border-t border-[#334155] px-6 pb-6">
            <Markdown style={markdownStyles}>{item.content}</Markdown>
          </View>
        )}
      </Card>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }} edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-[#334155] px-6 py-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="p-1"
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text className="text-[17px] font-bold text-[#f8fafc]">Documentation</Text>
        <View className="w-10" />
      </View>

      {/* Search Bar */}
      <View className="px-6 py-4">
        <View className="flex-row items-center gap-2 rounded-[20px] border border-[#334155] bg-[#1e293b] px-4 py-2">
          <Ionicons name="search" size={20} color={COLORS.textMuted} />
          <TextInput
            className="flex-1 py-1 text-[12px] text-[#f8fafc]"
            placeholder="Search documentation..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              activeOpacity={0.7}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Sections List */}
      <FlatList
        data={filteredSections}
        renderItem={renderSectionItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 24, paddingBottom: 64 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="items-center justify-center py-[48px]">
            <Ionicons
              name="document-text-outline"
              size={64}
              color={COLORS.textMuted}
            />
            <Text className="mt-4 text-[13px] font-semibold text-[#e2e8f0]">No documentation found</Text>
            <Text className="mt-1 text-[12px] text-[#94a3b8]">Try a different search term</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// Markdown styles
const markdownStyles = {
  body: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    lineHeight: 20,
  },
  heading1: {
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  heading2: {
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semibold,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  heading3: {
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: SPACING.md,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  strong: {
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  em: {
    fontStyle: "italic" as const,
  },
  bullet_list: {
    marginBottom: SPACING.md,
  },
  ordered_list: {
    marginBottom: SPACING.md,
  },
  list_item: {
    marginBottom: SPACING.xs,
    flexDirection: "row" as const,
  },
  bullet_list_icon: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.base,
    marginRight: SPACING.sm,
  },
  code_inline: {
    backgroundColor: COLORS.bgCard,
    color: COLORS.primary,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    fontFamily: "monospace" as const,
  },
  code_block: {
    backgroundColor: COLORS.bgCard,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fence: {
    backgroundColor: COLORS.bgCard,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  link: {
    color: COLORS.primary,
    textDecorationLine: "underline" as const,
  },
  blockquote: {
    backgroundColor: COLORS.bgCard,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    paddingLeft: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
};
