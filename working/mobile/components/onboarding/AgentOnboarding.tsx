/**
 * AgentOnboarding - Conversational first-launch onboarding through the AI agent.
 * Shows a chat-like interface where the agent asks the user about preferences.
 */
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  
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
      "Namaste! 🙏 I'm Matsya AI, your AI fishing assistant. I can help with weather, market prices, catch analysis, finding fishing zones, and much more.",
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
    <Animated.View className="flex-1 bg-[#0D1724] pt-[50px]" style={{ opacity: fadeAnim }}>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-6 pb-4 pt-2">
        <View className="h-11 w-11 items-center justify-center rounded-full border-2 border-[#3b82f640] bg-[#1e40af]">
          <Ionicons name="chatbubble" size={20} color="#fff" />
        </View>
        <View>
          <Text className="text-[15px] font-bold text-[#f8fafc]">Matsya AI</Text>
          <Text className="text-[10px] text-[#94a3b8]">Your AI Fishing Assistant</Text>
        </View>
        <TouchableOpacity
          className="ml-auto px-3 py-1.5"
          onPress={async () => {
            await AsyncStorage.setItem(ONBOARDING_KEY, "true");
            onComplete();
          }}
        >
          <Text className="text-[12px] font-medium text-[#94a3b8]">Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={visibleMessages}
        keyExtractor={(item) => `msg_${item.id}_${item.isAgent}`}
        className="flex-1"
        contentContainerStyle={{ padding: 24, gap: 12 }}
        renderItem={({ item }) => (
          <View
            className={`max-w-[85%] flex-row gap-2 p-3.5 ${
              item.isAgent
                ? "self-start rounded-[16px] bg-[#1D2A3D]"
                : "self-end rounded-[16px] rounded-br-[4px] bg-[#3B82F6]"
            }`}
          >
            {item.isAgent && (
              <View className="mt-[1px] h-[22px] w-[22px] items-center justify-center rounded-full bg-[#3b82f615]">
                <Ionicons
                  name="hardware-chip-outline"
                  size={12}
                  color={COLORS.primaryLight}
                />
              </View>
            )}
            <Text
              className={`flex-1 text-[12px] leading-[22px] ${
                item.isAgent ? "text-[#e2e8f0]" : "text-white"
              }`}
            >
              {item.text}
            </Text>
          </View>
        )}
      />

      {/* Options */}
      <View className="border-t border-white/10 bg-[#131F30] px-6 pb-8 pt-4">
        {step.type === "choice" && step.options && !choices[currentStep] && (
          <View className="mb-4 flex-row flex-wrap gap-2.5">
            {step.options.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                className="w-[47%] flex-grow flex-row items-center gap-2 rounded-[16px] border border-[#334155] bg-[#0f172a] px-4 py-3"
                onPress={() => handleChoice(currentStep, opt.value, opt.label)}
                activeOpacity={0.8}
              >
                {opt.icon && <Text className="text-[20px]">{opt.icon}</Text>}
                <Text className="flex-1 text-[12px] font-semibold text-[#f8fafc]">{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step.type === "info" && (
          <TouchableOpacity
            className="mb-4 flex-row items-center justify-center gap-2 rounded-[16px] bg-[#1e40af] py-3.5"
            onPress={() => handleContinue(currentStep)}
            activeOpacity={0.85}
          >
            <Text className="text-[13px] font-semibold text-white">
              {isLastStep ? "Get Started" : "Continue"}
            </Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Progress dots */}
        <View className="flex-row justify-center gap-2">
          {STEPS.map((_, i) => (
            <View
              key={i}
              className={`h-2 rounded-full ${
                i === currentStep
                  ? "w-5 bg-[#3b82f6]"
                  : i < currentStep
                  ? "w-2 bg-[#3b82f660]"
                  : "w-2 bg-[#334155]"
              }`}
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
