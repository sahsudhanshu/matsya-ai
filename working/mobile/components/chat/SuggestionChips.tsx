/**
 * SuggestionChips - Contextual follow-up suggestions shown after each agent
 * response based on the tools that were called.
 */
import React from "react";
import { ScrollView, TouchableOpacity, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../lib/constants";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

interface Suggestion {
  label: string;
  prompt: string;
  icon: IoniconName;
}

/** Generate contextual suggestions based on tools called and message content */
export function generateSuggestions(
  toolsCalled: string[],
  messageText: string,
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const lowerText = messageText.toLowerCase();

  // Weather-related
  if (toolsCalled.includes("get_weather") || lowerText.includes("weather")) {
    suggestions.push(
      {
        label: "Best fishing spots",
        prompt:
          "What are the best fishing spots near me given the current weather?",
        icon: "navigate",
      },
      {
        label: "Safe zones",
        prompt: "Which zones are safest for fishing today?",
        icon: "shield-checkmark",
      },
      {
        label: "Tomorrow's forecast",
        prompt: "What's the weather forecast for tomorrow?",
        icon: "sunny",
      },
    );
  }

  // Market prices
  if (
    toolsCalled.includes("get_market_prices") ||
    lowerText.includes("price") ||
    lowerText.includes("market")
  ) {
    suggestions.push(
      {
        label: "Price history",
        prompt: "Show me the price trend for the past week",
        icon: "trending-up",
      },
      {
        label: "Best time to sell",
        prompt: "When is the best time to sell today's catch?",
        icon: "time",
      },
      {
        label: "Nearest port",
        prompt: "Which port has the best prices near me?",
        icon: "boat",
      },
    );
  }

  // Catch history
  if (
    toolsCalled.includes("get_catch_history") ||
    toolsCalled.includes("get_catch_details") ||
    toolsCalled.includes("get_group_details")
  ) {
    suggestions.push(
      {
        label: "Compare catches",
        prompt: "How does this catch compare to my average?",
        icon: "analytics",
      },
      {
        label: "Find buyers",
        prompt: "Help me find buyers for this catch",
        icon: "people",
      },
      {
        label: "Storage tips",
        prompt: "How should I store this catch for maximum freshness?",
        icon: "snow",
      },
    );
  }

  // Fishing spots
  if (
    toolsCalled.includes("get_nearby_fishing_spots") ||
    toolsCalled.includes("get_map_data")
  ) {
    suggestions.push(
      {
        label: "Best species here",
        prompt: "What species are most commonly found in this area?",
        icon: "fish",
      },
      {
        label: "Regulations",
        prompt: "What fishing regulations apply to this zone?",
        icon: "document-text",
      },
      {
        label: "Route there",
        prompt: "What's the safest route to reach this spot?",
        icon: "compass",
      },
    );
  }

  // Web search
  if (toolsCalled.includes("web_search")) {
    suggestions.push(
      {
        label: "More details",
        prompt: "Can you give me more details about that?",
        icon: "information-circle",
      },
      {
        label: "Latest news",
        prompt: "What's the latest fishing news in my area?",
        icon: "newspaper",
      },
    );
  }

  // General scan/analysis
  if (
    lowerText.includes("species") ||
    lowerText.includes("analysis") ||
    lowerText.includes("detect")
  ) {
    suggestions.push(
      {
        label: "Compare ports",
        prompt: "Which port would give me the best price for this catch?",
        icon: "swap-horizontal",
      },
      {
        label: "Sustainability",
        prompt: "Is this catch within legal size limits?",
        icon: "leaf",
      },
    );
  }

  // Default suggestions if nothing matched
  if (suggestions.length === 0) {
    suggestions.push(
      {
        label: "Daily briefing",
        prompt: "Give me my daily fishing briefing",
        icon: "sunny",
      },
      {
        label: "Market prices",
        prompt: "What are today's market prices?",
        icon: "cash",
      },
      {
        label: "Fishing spots",
        prompt: "Where should I fish today?",
        icon: "navigate",
      },
    );
  }

  // Limit to 4 suggestions max
  return suggestions.slice(0, 4);
}

interface Props {
  suggestions: Suggestion[];
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

export function SuggestionChips({ suggestions, onSelect, disabled }: Props) {
  if (suggestions.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="px-4 py-[6px] gap-2"
      keyboardShouldPersistTaps="always"
    >
      {suggestions.map((s) => (
        <TouchableOpacity
          key={s.label}
          className="flex-row items-center gap-[6px] bg-bgCard rounded-full border border-[#1e40af40] px-[14px] py-2"
          onPress={() => onSelect(s.prompt)}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Ionicons name={s.icon} size={13} color={COLORS.primaryLight} />
          <Text className="text-[12px] text-textSecondary font-medium">{s.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
