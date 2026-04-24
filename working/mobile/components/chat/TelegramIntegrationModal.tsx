import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import Ionicons from "@expo/vector-icons/Ionicons";

interface TelegramIntegrationModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenTelegram: () => void;
}

export function TelegramIntegrationModal({
  visible,
  onClose,
  onOpenTelegram,
}: TelegramIntegrationModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons
                name="paper-plane"
                size={28}
                color={COLORS.primaryLight}
              />
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>Connect to Telegram</Text>
            <Text style={styles.description}>
              Get OceanAI assistance directly in Telegram! Chat with our AI
              assistant, get fishing advice, and receive notifications about
              ocean conditions.
            </Text>

            {/* Features */}
            <View style={styles.featuresSection}>
              <Text style={styles.sectionTitle}>What you can do:</Text>

              <View style={styles.feature}>
                <View style={styles.featureIcon}>
                  <Ionicons
                    name="chatbubbles"
                    size={20}
                    color={COLORS.primaryLight}
                  />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>
                    Chat with AI Assistant
                  </Text>
                  <Text style={styles.featureDesc}>
                    Get instant fishing advice and market insights
                  </Text>
                </View>
              </View>

              <View style={styles.feature}>
                <View style={styles.featureIcon}>
                  <Ionicons
                    name="notifications"
                    size={20}
                    color={COLORS.primaryLight}
                  />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>Receive Alerts</Text>
                  <Text style={styles.featureDesc}>
                    Get notified about weather warnings and ocean conditions
                  </Text>
                </View>
              </View>

              <View style={styles.feature}>
                <View style={styles.featureIcon}>
                  <Ionicons
                    name="images"
                    size={20}
                    color={COLORS.primaryLight}
                  />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>Analyze Catches</Text>
                  <Text style={styles.featureDesc}>
                    Send fish photos for instant species and quality analysis
                  </Text>
                </View>
              </View>

              <View style={styles.feature}>
                <View style={styles.featureIcon}>
                  <Ionicons
                    name="location"
                    size={20}
                    color={COLORS.primaryLight}
                  />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>Location-Based Tips</Text>
                  <Text style={styles.featureDesc}>
                    Get recommendations based on your current location
                  </Text>
                </View>
              </View>
            </View>

            {/* Instructions */}
            <View style={styles.instructionsSection}>
              <Text style={styles.sectionTitle}>How to connect:</Text>
              <View style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <Text style={styles.stepText}>
                  Tap "Open Telegram" below to launch the Telegram app
                </Text>
              </View>
              <View style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <Text style={styles.stepText}>
                  Tap "Start" in the Telegram chat to begin
                </Text>
              </View>
              <View style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <Text style={styles.stepText}>
                  Start chatting with OceanAI Assistant on Telegram!
                </Text>
              </View>
            </View>

            <View style={styles.note}>
              <Ionicons
                name="information-circle"
                size={16}
                color={COLORS.info}
              />
              <Text style={styles.noteText}>
                You'll need the Telegram app installed to use this feature.
              </Text>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                onOpenTelegram();
                onClose();
              }}
            >
              <Ionicons name="paper-plane" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>Open Telegram</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
              <Text style={styles.secondaryBtnText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.lg,
  },
  modal: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS["2xl"],
    width: "100%",
    maxWidth: 500,
    maxHeight: "90%",
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtn: {
    padding: SPACING.xs,
  },
  content: {
    padding: SPACING.lg,
  },
  title: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  description: {
    fontSize: FONTS.sizes.base,
    color: COLORS.textSecondary,
    lineHeight: 24,
    marginBottom: SPACING.lg,
  },
  featuresSection: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  feature: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: SPACING.md,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + "15",
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING.sm,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  instructionsSection: {
    marginBottom: SPACING.lg,
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: SPACING.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING.sm,
  },
  stepNumberText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: "#fff",
  },
  stepText: {
    flex: 1,
    fontSize: FONTS.sizes.base,
    color: COLORS.textSecondary,
    lineHeight: 22,
    paddingTop: 4,
  },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: COLORS.info + "15",
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  noteText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  actions: {
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.sm,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    gap: SPACING.sm,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryBtnText: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: "#fff",
  },
  secondaryBtn: {
    alignItems: "center",
    padding: SPACING.sm,
  },
  secondaryBtnText: {
    fontSize: FONTS.sizes.base,
    color: COLORS.textMuted,
  },
});
