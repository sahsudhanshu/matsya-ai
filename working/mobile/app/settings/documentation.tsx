import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
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
      <Card padding={0} style={styles.sectionCard}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => handleSectionPress(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.sectionHeaderLeft}>
            <View style={styles.iconContainer}>
              <Ionicons
                name={item.icon as any}
                size={24}
                color={COLORS.primary}
              />
            </View>
            <Text style={styles.sectionTitle}>{item.title}</Text>
          </View>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={COLORS.textMuted}
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.sectionContent}>
            <Markdown style={markdownStyles}>{item.content}</Markdown>
          </View>
        )}
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Documentation</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
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
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name="document-text-outline"
              size={64}
              color={COLORS.textMuted}
            />
            <Text style={styles.emptyText}>No documentation found</Text>
            <Text style={styles.emptySubtext}>Try a different search term</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.xs,
  },
  title: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    paddingVertical: SPACING.xs,
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING["3xl"],
  },
  sectionCard: {
    marginBottom: SPACING.md,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: SPACING.lg,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    flex: 1,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
    flex: 1,
  },
  sectionContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING["2xl"],
  },
  emptyText: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
});

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
