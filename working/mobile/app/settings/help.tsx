import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Linking,
  Alert,
  Platform,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as MailComposer from "expo-mail-composer";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import { Card } from "../../components/ui/Card";
import faqData from "../../assets/help/faqs.json";

type SystemStatus = "operational" | "degraded" | "down";

interface FAQ {
  id: string;
  question: string;
  answer: string;
}

interface FAQCategory {
  id: string;
  title: string;
  faqs: FAQ[];
}

export default function HelpScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [systemStatus] = useState<SystemStatus>("operational");

  // Filter FAQs based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return faqData.categories as FAQCategory[];
    }

    const query = searchQuery.toLowerCase();
    return faqData.categories
      .map((category) => ({
        ...category,
        faqs: category.faqs.filter(
          (faq) =>
            faq.question.toLowerCase().includes(query) ||
            faq.answer.toLowerCase().includes(query),
        ),
      }))
      .filter((category) => category.faqs.length > 0);
  }, [searchQuery]);

  const handleEmailSupport = async () => {
    try {
      const isAvailable = await MailComposer.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert(
          "Email Not Available",
          "Please send an email to support@oceanai.app from your email app.",
        );
        return;
      }

      await MailComposer.composeAsync({
        recipients: ["support@oceanai.app"],
        subject: "OceanAI Support Request",
        body: `\n\n---\nApp Version: 1.0.0\nPlatform: ${Platform.OS} ${Platform.Version}\n`,
      });
    } catch (error) {
      console.error("Error opening email:", error);
      Alert.alert("Error", "Failed to open email composer");
    }
  };

  const handlePhoneSupport = () => {
    Alert.alert(
      "Phone Support",
      "Call our support team at:\n+91-1800-XXX-XXXX\n\nAvailable Mon-Fri, 9 AM - 6 PM IST",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call Now",
          onPress: () => Linking.openURL("tel:+911800XXXXXX"),
        },
      ],
    );
  };

  const handleTelegramSupport = async () => {
    const telegramUrl = "https://t.me/OceanAIBot";
    const canOpen = await Linking.canOpenURL(telegramUrl);

    if (canOpen) {
      await Linking.openURL(telegramUrl);
    } else {
      Alert.alert(
        "Telegram Not Installed",
        "Please install Telegram to use this feature, or visit t.me/OceanAIBot in your browser.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open Browser",
            onPress: () => Linking.openURL(telegramUrl),
          },
        ],
      );
    }
  };

  const toggleFAQ = (faqId: string) => {
    setExpandedFAQ(expandedFAQ === faqId ? null : faqId);
  };

  const getStatusColor = (status: SystemStatus) => {
    switch (status) {
      case "operational":
        return COLORS.success;
      case "degraded":
        return COLORS.warning;
      case "down":
        return COLORS.error;
    }
  };

  const getStatusText = (status: SystemStatus) => {
    switch (status) {
      case "operational":
        return "All Systems Operational";
      case "degraded":
        return "Degraded Performance";
      case "down":
        return "System Outage";
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Help & Support</Text>
        </View>

        {/* System Status */}
        <Card style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: getStatusColor(systemStatus) },
              ]}
            />
            <Text style={styles.statusText}>{getStatusText(systemStatus)}</Text>
          </View>
          <Text style={styles.statusSubtext}>
            All services are running normally
          </Text>
        </Card>

        {/* Contact Support */}
        <Text style={styles.sectionLabel}>Contact Support</Text>
        <Card padding={0} style={styles.contactCard}>
          <TouchableOpacity
            style={styles.contactOption}
            onPress={handleEmailSupport}
            activeOpacity={0.7}
          >
            <View style={styles.contactIconContainer}>
              <Ionicons name="mail" size={24} color={COLORS.primary} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>Email Support</Text>
              <Text style={styles.contactSubtitle}>support@oceanai.app</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.contactOption}
            onPress={handlePhoneSupport}
            activeOpacity={0.7}
          >
            <View style={styles.contactIconContainer}>
              <Ionicons name="call" size={24} color={COLORS.success} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>Phone Support</Text>
              <Text style={styles.contactSubtitle}>
                +91-1800-XXX-XXXX (Mon-Fri, 9-6 IST)
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.contactOption}
            onPress={handleTelegramSupport}
            activeOpacity={0.7}
          >
            <View style={styles.contactIconContainer}>
              <Ionicons name="paper-plane" size={24} color={COLORS.info} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>Telegram Bot</Text>
              <Text style={styles.contactSubtitle}>@OceanAIBot</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>
        </Card>

        {/* Search FAQs */}
        <Text style={styles.sectionLabel}>Frequently Asked Questions</Text>
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color={COLORS.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search FAQs..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={styles.clearButton}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* FAQ Categories */}
        {filteredCategories.length === 0 ? (
          <Card style={styles.emptyState}>
            <Ionicons
              name="search-outline"
              size={48}
              color={COLORS.textMuted}
            />
            <Text style={styles.emptyStateText}>No FAQs found</Text>
            <Text style={styles.emptyStateSubtext}>
              Try a different search term or contact support
            </Text>
          </Card>
        ) : (
          filteredCategories.map((category) => (
            <View key={category.id} style={styles.categoryContainer}>
              <Text style={styles.categoryTitle}>{category.title}</Text>
              <Card padding={0} style={styles.faqCard}>
                {category.faqs.map((faq, index) => (
                  <View key={faq.id}>
                    {index > 0 && <View style={styles.divider} />}
                    <TouchableOpacity
                      style={styles.faqItem}
                      onPress={() => toggleFAQ(faq.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.faqHeader}>
                        <Text style={styles.faqQuestion}>{faq.question}</Text>
                        <Ionicons
                          name={
                            expandedFAQ === faq.id
                              ? "chevron-up"
                              : "chevron-down"
                          }
                          size={20}
                          color={COLORS.textMuted}
                        />
                      </View>
                      {expandedFAQ === faq.id && (
                        <Text style={styles.faqAnswer}>{faq.answer}</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </Card>
            </View>
          ))
        )}

        {/* Quick Links */}
        <Text style={styles.sectionLabel}>Quick Links</Text>
        <Card padding={0} style={styles.linksCard}>
          <TouchableOpacity
            style={styles.linkOption}
            onPress={() => router.push("/settings/documentation" as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="book" size={20} color={COLORS.textSecondary} />
            <Text style={styles.linkText}>Documentation</Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.linkOption}
            onPress={() =>
              Linking.openURL("https://oceanai.app/terms-of-service")
            }
            activeOpacity={0.7}
          >
            <Ionicons
              name="document-text"
              size={20}
              color={COLORS.textSecondary}
            />
            <Text style={styles.linkText}>Terms of Service</Text>
            <Ionicons name="open" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.linkOption}
            onPress={() =>
              Linking.openURL("https://oceanai.app/privacy-policy")
            }
            activeOpacity={0.7}
          >
            <Ionicons
              name="shield-checkmark"
              size={20}
              color={COLORS.textSecondary}
            />
            <Text style={styles.linkText}>Privacy Policy</Text>
            <Ionicons name="open" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.linkOption}
            onPress={() =>
              Linking.openURL("https://oceanai.app/community-guidelines")
            }
            activeOpacity={0.7}
          >
            <Ionicons name="people" size={20} color={COLORS.textSecondary} />
            <Text style={styles.linkText}>Community Guidelines</Text>
            <Ionicons name="open" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* App Info */}
        <Card style={styles.appInfoCard}>
          <Text style={styles.appInfoTitle}>OceanAI</Text>
          <Text style={styles.appInfoVersion}>Version 1.0.0</Text>
          <Text style={styles.appInfoSubtext}>
            Build {Platform.OS === "ios" ? "iOS" : "Android"} · AWS AI for
            Bharat Challenge
          </Text>
        </Card>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgDark },
  scroll: { flex: 1 },
  content: { padding: SPACING.xl, paddingBottom: SPACING["4xl"] },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.xl,
    gap: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.bgCard,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    fontSize: FONTS.sizes["2xl"],
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.extrabold,
    flex: 1,
  },

  sectionLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSubtle,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: SPACING.sm,
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xs,
  },

  statusCard: {
    marginBottom: SPACING.md,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusText: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  statusSubtext: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginLeft: 20,
  },

  contactCard: {
    marginBottom: SPACING.md,
    overflow: "hidden",
  },
  contactOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  contactIconContainer: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.bgDark,
    alignItems: "center",
    justifyContent: "center",
  },
  contactInfo: {
    flex: 1,
  },
  contactTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  contactSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FONTS.sizes.base,
    color: COLORS.textPrimary,
    paddingVertical: SPACING.md,
  },
  clearButton: {
    padding: SPACING.xs,
  },

  categoryContainer: {
    marginBottom: SPACING.lg,
  },
  categoryTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  faqCard: {
    overflow: "hidden",
  },
  faqItem: {
    padding: SPACING.lg,
  },
  faqHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  faqQuestion: {
    flex: 1,
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
  },
  faqAnswer: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    lineHeight: 20,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },

  emptyState: {
    alignItems: "center",
    padding: SPACING["2xl"],
  },
  emptyStateText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
  },
  emptyStateSubtext: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    textAlign: "center",
  },

  linksCard: {
    marginBottom: SPACING.md,
    overflow: "hidden",
  },
  linkOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  linkText: {
    flex: 1,
    fontSize: FONTS.sizes.base,
    color: COLORS.textSecondary,
  },

  appInfoCard: {
    alignItems: "center",
    padding: SPACING.xl,
    marginTop: SPACING.md,
  },
  appInfoTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.extrabold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  appInfoVersion: {
    fontSize: FONTS.sizes.base,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  appInfoSubtext: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    textAlign: "center",
  },
});
