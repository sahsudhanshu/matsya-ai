import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Alert,
  Platform,
} from "react-native";
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
        subject: "Matsya AI Support Request",
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
    const telegramUrl = "https://t.me/Matsya AIBot";
    const canOpen = await Linking.canOpenURL(telegramUrl);

    if (canOpen) {
      await Linking.openURL(telegramUrl);
    } else {
      Alert.alert(
        "Telegram Not Installed",
        "Please install Telegram to use this feature, or visit t.me/Matsya AIBot in your browser.",
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 32, paddingBottom: 96 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-8 flex-row items-center gap-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-2xl border border-[#334155] bg-[#1e293b]"
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text className="flex-1 text-[22px] font-extrabold text-[#f8fafc]">
            Help & Support
          </Text>
        </View>

        {/* System Status */}
        <Card className="mb-4">
          <View className="mb-1 flex-row items-center gap-2.5">
            <View
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: getStatusColor(systemStatus) }}
            />
            <Text className="text-[13px] font-bold text-[#f8fafc]">
              {getStatusText(systemStatus)}
            </Text>
          </View>
          <Text className="ml-5 text-[12px] text-[#94a3b8]">
            All services are running normally
          </Text>
        </Card>

        {/* Contact Support */}
        <Text className="mb-2 mt-4 px-1 text-[10px] font-bold uppercase tracking-[1.2px] text-[#64748b]">
          Contact Support
        </Text>
        <Card padding={0} className="mb-4 overflow-hidden">
          <TouchableOpacity
            className="flex-row items-center gap-4 p-6"
            onPress={handleEmailSupport}
            activeOpacity={0.7}
          >
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#0f172a]">
              <Ionicons name="mail" size={24} color={COLORS.primary} />
            </View>
            <View className="flex-1">
              <Text className="mb-1 text-[13px] font-semibold text-[#f8fafc]">
                Email Support
              </Text>
              <Text className="text-[12px] text-[#94a3b8]">
                support@oceanai.app
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>

          <View className="h-px bg-[#334155]" />

          <TouchableOpacity
            className="flex-row items-center gap-4 p-6"
            onPress={handlePhoneSupport}
            activeOpacity={0.7}
          >
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#0f172a]">
              <Ionicons name="call" size={24} color={COLORS.success} />
            </View>
            <View className="flex-1">
              <Text className="mb-1 text-[13px] font-semibold text-[#f8fafc]">
                Phone Support
              </Text>
              <Text className="text-[12px] text-[#94a3b8]">
                +91-1800-XXX-XXXX (Mon-Fri, 9-6 IST)
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>

          <View className="h-px bg-[#334155]" />

          <TouchableOpacity
            className="flex-row items-center gap-4 p-6"
            onPress={handleTelegramSupport}
            activeOpacity={0.7}
          >
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#0f172a]">
              <Ionicons name="paper-plane" size={24} color={COLORS.info} />
            </View>
            <View className="flex-1">
              <Text className="mb-1 text-[13px] font-semibold text-[#f8fafc]">
                Telegram Bot
              </Text>
              <Text className="text-[12px] text-[#94a3b8]">@Matsya AIBot</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>
        </Card>

        {/* Search FAQs */}
        <Text className="mb-2 mt-4 px-1 text-[10px] font-bold uppercase tracking-[1.2px] text-[#64748b]">
          Frequently Asked Questions
        </Text>
        <View className="mb-4 flex-row items-center rounded-2xl border border-[#334155] bg-[#1e293b] px-4">
          <Ionicons
            name="search"
            size={20}
            color={COLORS.textMuted}
            style={{ marginRight: 8 }}
          />
          <TextInput
            className="flex-1 py-4 text-[13px] text-[#f8fafc]"
            placeholder="Search FAQs..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              className="p-1"
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
          <Card className="items-center py-8 px-4">
            <Ionicons
              name="search-outline"
              size={48}
              color={COLORS.textMuted}
            />
            <Text className="mt-4 text-[16px] font-semibold text-[#f8fafc]">No FAQs found</Text>
            <Text className="mt-2 text-center text-[14px] text-[#94a3b8]">
              Try a different search term or contact support
            </Text>
          </Card>
        ) : (
          filteredCategories.map((category) => (
            <View key={category.id} className="mb-6">
              <Text className="mb-3 px-1 text-[13px] font-bold text-[#f8fafc]">
                {category.title}
              </Text>
              <Card padding={0} className="overflow-hidden">
                {category.faqs.map((faq, index) => (
                  <View key={faq.id}>
                    {index > 0 && <View className="h-px bg-[#334155]" />}
                    <TouchableOpacity
                      className="p-6"
                      onPress={() => toggleFAQ(faq.id)}
                      activeOpacity={0.7}
                    >
                      <View className="flex-row items-start justify-between gap-4">
                        <Text className="flex-1 text-[13px] font-semibold text-[#f8fafc]">
                          {faq.question}
                        </Text>
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
                        <Text className="mt-4 text-[12px] leading-5 text-[#e2e8f0]">
                          {faq.answer}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </Card>
            </View>
          ))
        )}

        {/* Quick Links */}
        <Text className="mb-2 mt-4 px-1 text-[10px] font-bold uppercase tracking-[1.2px] text-[#64748b]">
          Quick Links
        </Text>
        <Card padding={0} className="mb-4 overflow-hidden">
          <TouchableOpacity
            className="flex-row items-center gap-4 p-6"
            onPress={() => router.push("/settings/documentation" as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="book" size={20} color={COLORS.textSecondary} />
            <Text className="flex-1 text-[13px] text-[#e2e8f0]">
              Documentation
            </Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>

          <View className="h-px bg-[#334155]" />

          <TouchableOpacity
            className="flex-row items-center gap-4 p-6"
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
            <Text className="flex-1 text-[13px] text-[#e2e8f0]">
              Terms of Service
            </Text>
            <Ionicons name="open" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>

          <View className="h-px bg-[#334155]" />

          <TouchableOpacity
            className="flex-row items-center gap-4 p-6"
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
            <Text className="flex-1 text-[13px] text-[#e2e8f0]">
              Privacy Policy
            </Text>
            <Ionicons name="open" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>

          <View className="h-px bg-[#334155]" />

          <TouchableOpacity
            className="flex-row items-center gap-4 p-6"
            onPress={() =>
              Linking.openURL("https://oceanai.app/community-guidelines")
            }
            activeOpacity={0.7}
          >
            <Ionicons name="people" size={20} color={COLORS.textSecondary} />
            <Text className="flex-1 text-[13px] text-[#e2e8f0]">
              Community Guidelines
            </Text>
            <Ionicons name="open" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* App Info */}
        <Card className="mt-4 items-center p-6">
          <Text className="mb-1 text-[20px] font-extrabold text-[#f8fafc]">
            Matsya AI
          </Text>
          <Text className="mb-1 text-[13px] text-[#e2e8f0]">Version 1.0.0</Text>
          <Text className="text-center text-[12px] text-[#94a3b8]">
            Build {Platform.OS === "ios" ? "iOS" : "Android"} · AWS AI for
            Bharat Challenge
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
