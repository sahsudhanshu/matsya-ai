/**
 * AgentOnboarding - Conversational first-launch onboarding through the AI agent.
 * Shows a chat-like interface where the agent asks the user about preferences.
 */
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ONBOARDING_KEY = "ocean_ai_onboarding_complete";

interface OnboardingStep {
  agentMessage: string;
  options?: { label: string; value: string; icon?: string }[];
  type: "choice" | "info";
}

const STEPS: OnboardingStep[] = [
  {
    type: "info",
    agentMessage:
      "Namaste! 🙏 I'm SagarMitra, your AI fishing assistant. I can help with weather, market prices, catch analysis, finding fishing zones, and much more.",
  },
  {
    type: "choice",
    agentMessage: "What type of fishing do you primarily do?",
    options: [
      { label: "Deep Sea", value: "deep_sea", icon: "🚢" },
      { label: "Coastal", value: "coastal", icon: "🏖️" },
      { label: "River/Lake", value: "freshwater", icon: "🏞️" },
      { label: "Mixed", value: "mixed", icon: "🎣" },
    ],
  },
  {
    type: "choice",
    agentMessage: "What's most important to you right now?",
    options: [
      { label: "Best Market Prices", value: "prices", icon: "💰" },
      { label: "Weather & Safety", value: "weather", icon: "⛈️" },
      { label: "Finding Fish", value: "zones", icon: "🐟" },
      { label: "Disease Detection", value: "disease", icon: "🔬" },
    ],
  },
  {
    type: "info",
    agentMessage:
      "Great! I'll personalize your experience based on your preferences. You can always talk to me anytime - just tap the chat button. Let's get started! 🎣",
  },
];

interface Props {
  onComplete: () => void;
}

export function AgentOnboarding({ onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [visibleMessages, setVisibleMessages] = useState<
    { text: string; isAgent: boolean; id: number }[]
  >([]);
  const [choices, setChoices] = useState<Record<number, string>>({});
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    // Show first message with animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
    addAgentMessage(STEPS[0].agentMessage, 0);
  }, []);

  const addAgentMessage = (text: string, id: number) => {
    setVisibleMessages((prev) => [...prev, { text, isAgent: true, id }]);
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleChoice = async (
    stepIndex: number,
    value: string,
    label: string,
  ) => {
    setChoices((prev) => ({ ...prev, [stepIndex]: value }));

    // Add user choice as a message
    setVisibleMessages((prev) => [
      ...prev,
      { text: label, isAgent: false, id: stepIndex * 100 },
    ]);

    const nextStep = stepIndex + 1;
    if (nextStep < STEPS.length) {
      // Delay agent response for natural feel
      setTimeout(() => {
        setCurrentStep(nextStep);
        addAgentMessage(STEPS[nextStep].agentMessage, nextStep);
      }, 600);
    }
  };

  const handleContinue = async (stepIndex: number) => {
    const nextStep = stepIndex + 1;
    if (nextStep < STEPS.length) {
      setTimeout(() => {
        setCurrentStep(nextStep);
        addAgentMessage(STEPS[nextStep].agentMessage, nextStep);
      }, 400);
    } else {
      // Onboarding complete
      await AsyncStorage.setItem(ONBOARDING_KEY, "true");
      try {
        await AsyncStorage.setItem(
          "ocean_ai_user_prefs_onboard",
          JSON.stringify(choices),
        );
      } catch {}
      onComplete();
    }
  };

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.agentAvatar}>
          <Ionicons name="chatbubble" size={20} color="#fff" />
        </View>
        <View>
          <Text style={styles.agentName}>SagarMitra</Text>
          <Text style={styles.agentSub}>Your AI Fishing Assistant</Text>
        </View>
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={async () => {
            await AsyncStorage.setItem(ONBOARDING_KEY, "true");
            onComplete();
          }}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={visibleMessages}
        keyExtractor={(item) => `msg_${item.id}_${item.isAgent}`}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        renderItem={({ item }) => (
          <View
            style={[
              styles.messageBubble,
              item.isAgent ? styles.agentBubble : styles.userBubble,
            ]}
          >
            {item.isAgent && (
              <View style={styles.bubbleAvatar}>
                <Ionicons
                  name="hardware-chip-outline"
                  size={12}
                  color={COLORS.primaryLight}
                />
              </View>
            )}
            <Text
              style={[
                styles.messageText,
                !item.isAgent && styles.userMessageText,
              ]}
            >
              {item.text}
            </Text>
          </View>
        )}
      />

      {/* Options */}
      <View style={styles.optionsArea}>
        {step.type === "choice" && step.options && !choices[currentStep] && (
          <View style={styles.optionsGrid}>
            {step.options.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={styles.optionBtn}
                onPress={() => handleChoice(currentStep, opt.value, opt.label)}
                activeOpacity={0.8}
              >
                {opt.icon && <Text style={styles.optionIcon}>{opt.icon}</Text>}
                <Text style={styles.optionLabel}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step.type === "info" && (
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={() => handleContinue(currentStep)}
            activeOpacity={0.85}
          >
            <Text style={styles.continueBtnText}>
              {isLastStep ? "Get Started" : "Continue"}
            </Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Progress dots */}
        <View style={styles.progressRow}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i === currentStep && styles.progressDotActive,
                i < currentStep && styles.progressDotDone,
              ]}
            />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

export async function shouldShowOnboarding(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY);
    return value !== "true";
  } catch (error) {
    console.error("Failed to read onboarding status from AsyncStorage:", error);
    // On error, default to showing onboarding to avoid skipping it unintentionally.
    return true;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  agentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.primaryLight + "40",
  },
  agentName: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  agentSub: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
  },
  skipBtn: {
    marginLeft: "auto",
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.medium,
  },

  messageList: {
    flex: 1,
  },
  messageContent: {
    padding: SPACING.lg,
    gap: 12,
  },
  messageBubble: {
    maxWidth: "85%",
    borderRadius: RADIUS.lg,
    padding: 14,
    flexDirection: "row",
    gap: 8,
  },
  agentBubble: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primaryLight + "15",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  messageText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 22,
    flex: 1,
  },
  userMessageText: {
    color: "#fff",
  },

  optionsArea: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: SPACING.md,
  },
  optionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.bgDark,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: "47%",
    flexGrow: 1,
  },
  optionIcon: {
    fontSize: 18,
  },
  optionLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
  },

  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    gap: 8,
    marginBottom: SPACING.md,
  },
  continueBtnText: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semibold,
    color: "#fff",
  },

  progressRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  progressDotActive: {
    backgroundColor: COLORS.primaryLight,
    width: 20,
  },
  progressDotDone: {
    backgroundColor: COLORS.primaryLight + "60",
  },
});
