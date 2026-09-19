import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  Modal,
  Animated,
  Dimensions,
  Alert,
  Image,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  GestureHandlerRootView,
  Swipeable,
} from "react-native-gesture-handler";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import { useAuth } from "../../lib/auth-context";
import { useLanguage } from "../../lib/i18n";
import { useNetwork } from "../../lib/network-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useNavigation, router } from "expo-router";
import * as Speech from "expo-speech";
import * as Location from "expo-location";
import { Audio } from "expo-av";
import { synthesizeSpeech } from "../../lib/api-client";
import { chatStreamClient } from "../../lib/chat-stream-client";
import { StreamingText } from "../../components/chat/StreamingText";
import Markdown from "react-native-markdown-display";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { EmptyState } from "../../components/ui/EmptyState";
import { AnalysisPicker } from "../../components/chat/AnalysisPicker";
import { TelegramIntegrationModal } from "../../components/chat/TelegramIntegrationModal";
import { WeightEstimateModal } from "../../components/WeightEstimateModal";
import { GroupFishPickerModal } from "../../components/chat/GroupFishPickerModal";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { DeepLinkService } from "../../lib/deep-link-service";
import { ProfileMenu } from "../../components/ui/ProfileMenu";
import { InlineMapWidget } from "../../components/chat/InlineMapWidget";
import { InlineCatchCarousel } from "../../components/chat/InlineCatchCarousel";
import { InlineUploadCard } from "../../components/chat/InlineUploadCard";
import {
  ToolTransparency,
  ToolsBadge,
} from "../../components/chat/ToolTransparency";
import {
  SuggestionChips,
  generateSuggestions,
} from "../../components/chat/SuggestionChips";
import { ScanResultCard } from "../../components/chat/ScanResultCard";
import { useAgentContext } from "../../lib/agent-context";
import { sanitiseAgentText } from "../../lib/chat-stream-client";
import { useVoiceInput } from "../../hooks/useVoiceInput";
import { ChatSkeleton } from "../../components/chat/ChatSkeleton";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const CONVERSATIONS_STORAGE_KEY = "@chat/conversations";

interface UIMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
  replyTo?: {
    id: string;
    text: string;
    role: "user" | "assistant";
  };
  referencedAnalysis?: {
    id: string;
    imageUrl: string;
    species?: string;
    type: "single" | "group";
  };
  /** UI actions returned by the agent for this message */
  uiActions?: any;
  /** Tool names called during generation */
  toolsCalled?: string[];
  /** Scan result data for post-scan agent takeover */
  scanResult?: {
    fishCount: number;
    detections: Array<{
      species: string;
      weight: number;
      quality: string;
      healthy: boolean;
    }>;
    totalValue: number;
    groupId: string;
  };
}

interface StoredConversation {
  id: string;
  title: string;
  lastMessageTime: string;
}

export default function ChatScreen() {
  const { user } = useAuth();
  const { t, speechCode, locale } = useLanguage();
  const { effectiveMode } = useNetwork();
  const agentCtx = useAgentContext();

  const { isListening, startListening, stopListening } = useVoiceInput({
    lang: speechCode || "en-IN",
    onResult: (transcript) => {
      if (transcript)
        setInputText((prev) => (prev ? prev + " " + transcript : transcript));
    },
  });

  const params = useLocalSearchParams();
  const navigation = useNavigation();

  const QUICK_ACTIONS = [
    t("chat.actionFishToday"),
    t("chat.actionMarketPrices"),
    t("chat.actionOceanConditions"),
    t("chat.actionSustainability"),
    t("chat.actionRegulations"),
    t("chat.actionTips"),
  ];

  const QUICK_ACTION_ANALYZE = "Analyze this catch";

  // Agent capability definitions for the hub grid
  type AgentCapability = {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    label: string;
    prompt?: string;
    action?: string;
    color: string;
    desc: string;
  };

  const AGENT_CAPABILITIES: AgentCapability[] = [
    {
      icon: "camera",
      label: "Analyze Catch",
      action: "openCamera",
      color: COLORS.primary,
      desc: "Identify species & health",
    },
    {
      icon: "scale",
      label: "Estimate Weight",
      action: "openWeightEstimator",
      color: "#f59e0b",
      desc: "On-device weight model",
    },
    {
      icon: "sunny",
      label: "Daily Briefing",
      prompt:
        "Give me my daily fishing briefing - weather conditions, best fishing zones near me, today's market prices, and any active safety alerts for my area.",
      color: COLORS.secondary,
      desc: "Weather, zones & alerts",
    },

    {
      icon: "navigate",
      label: "Fishing Zones",
      prompt:
        "What are the best fishing zones near me right now? Consider current weather conditions, recent catch reports, and seasonal patterns.",
      color: COLORS.accent,
      desc: "Best spots near you",
    },
    {
      icon: "cash",
      label: "Market Prices",
      prompt:
        "What are today's market prices for fish in my area? Which species are trending up in price? What should I target for maximum earnings?",
      color: "#06b6d4",
      desc: "Real-time price intel",
    },
    {
      icon: "warning",
      label: "Safety Alerts",
      prompt:
        "Are there any active safety alerts, cyclone warnings, tsunami advisories, or dangerous weather conditions near my location?",
      color: "#ef4444",
      desc: "Warnings & advisories",
    },
  ];

  const [messages, setMessages] = useState<UIMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: t("chat.welcome"),
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<StoredConversation[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [refreshingSidebar, setRefreshingSidebar] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null,
  );
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [replyingTo, setReplyingTo] = useState<UIMessage | null>(null);
  const [showAnalysisPicker, setShowAnalysisPicker] = useState(false);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [referencedAnalysis, setReferencedAnalysis] = useState<{
    id: string;
    imageUrl: string;
    species?: string;
    type: "single" | "group";
  } | null>(null);

  // Weight estimation state
  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [weightSpecies, setWeightSpecies] = useState("Tilapia");
  const [weightFishIndex, setWeightFishIndex] = useState(0);
  const [groupFishPickerVisible, setGroupFishPickerVisible] = useState(false);

  // Selected quick tips context
  const [selectedTips, setSelectedTips] = useState<string[]>([]);

  // Tool transparency state (live tool calls during streaming)
  const [liveToolCalls, setLiveToolCalls] = useState<string[]>([]);
  // Last message suggestion chips
  const [lastSuggestions, setLastSuggestions] = useState<
    ReturnType<typeof generateSuggestions>
  >([]);

  // Track agent context screen
  useEffect(() => {
    agentCtx.updateScreen("chat");
  }, []);

  // Handle agent context param (from Ask Agent FAB on other screens)
  useEffect(() => {
    if (params.agentContext && !initialMessageSent.current) {
      initialMessageSent.current = true;
      setCurrentChatId(null);
      setMessages([]);
      setTimeout(() => {
        sendMessage(params.agentContext as string);
      }, 500);
    }
  }, [params.agentContext]);

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  const flatListRef = useRef<FlatList>(null);
  const initialMessageSent = useRef(false);
  const sidebarAnim = useRef(new Animated.Value(-SCREEN_WIDTH * 0.75)).current;
  const swipeableRefs = useRef<Map<string, any>>(new Map());
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;

  // Format timestamp for display
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
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

  // Persist conversations to AsyncStorage
  const persistConversations = async (conversations: StoredConversation[]) => {
    try {
      await AsyncStorage.setItem(
        CONVERSATIONS_STORAGE_KEY,
        JSON.stringify(conversations),
      );
    } catch (error) {
      console.warn("Failed to persist conversations:", error);
    }
  };

  // Load conversations from AsyncStorage
  const loadStoredConversations = async () => {
    try {
      const stored = await AsyncStorage.getItem(CONVERSATIONS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as StoredConversation[];
        setChats(parsed);
        return parsed;
      }
    } catch (error) {
      console.warn("Failed to load stored conversations:", error);
    }
    return [];
  };

  // Sync conversations with backend
  const syncConversations = async () => {
    if (effectiveMode === "offline") return;

    try {
      const { getConversationsList } = await import("../../lib/api-client");
      const backendConversations = await getConversationsList();
      const stored: StoredConversation[] = backendConversations.map((c) => ({
        id: c.conversationId,
        title: c.title,
        lastMessageTime: c.updatedAt,
      }));
      setChats(stored);
      await persistConversations(stored);
    } catch (error) {
      console.warn("Failed to sync conversations:", error);
    }
  };

  const handleRefreshSidebar = async () => {
    setRefreshingSidebar(true);
    await syncConversations();
    setRefreshingSidebar(false);
  };

  // Reset initial message flag when component unmounts or chat changes
  useEffect(() => {
    return () => {
      initialMessageSent.current = false;
    };
  }, [currentChatId]);

  // Get user location on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setUserLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      } catch (error) {
        console.warn("Failed to get location:", error);
      }
    })();
  }, []);

  useEffect(() => {
    if (params.initialMessage && !initialMessageSent.current) {
      initialMessageSent.current = true;
      setCurrentChatId(null);
      setMessages([]);
      setTimeout(() => {
        sendMessage(params.initialMessage as string);
      }, 500);
    }
  }, [params]);

  // Handle deep link parameters from other screens
  useEffect(() => {
    // Analysis context from Upload screen
    if (params.analysisId && params.species && params.imageUrl) {
      setReferencedAnalysis({
        id: params.analysisId as string,
        imageUrl: params.imageUrl as string,
        species: params.species as string,
        type: "single",
      });

      // If weight is provided, auto-send context message
      if (params.weight) {
        const weightG = parseFloat(params.weight as string);
        const kgStr = (weightG / 1000).toFixed(2);
        setTimeout(() => {
          setSelectedTips((prev) => [
            ...prev,
            `Analyzed ${params.species} - Est. weight: ${kgStr} kg`,
          ]);
        }, 500);
      }
    }

    // Catch history context from History screen
    if (params.catchId && params.species) {
      setReferencedAnalysis({
        id: params.catchId as string,
        imageUrl: (params.catchImageUrl as string) || "",
        species: params.species as string,
        type: "single",
      });

      // Auto-send context message
      const catchDate = params.catchDate
        ? new Date(params.catchDate as string).toLocaleDateString()
        : "recently";
      const weightInfo = params.catchWeight
        ? ` weighing ${params.catchWeight}kg`
        : "";
      setTimeout(() => {
        setSelectedTips((prev) => [
          ...prev,
          `Caught ${params.species}${weightInfo} on ${catchDate}`,
        ]);
      }, 500);
    }

    // Zone context from Map screen
    if (params.zoneName && params.zoneCoordinates) {
      setTimeout(() => {
        setSelectedTips((prev) => [
          ...prev,
          `Fishing zone: "${params.zoneName}" at ${params.zoneCoordinates}`,
        ]);
      }, 500);
    }

    // Marker context from Map screen
    if (params.markerType && params.markerCoordinates) {
      setTimeout(() => {
        setSelectedTips((prev) => [
          ...prev,
          `Location: ${params.markerCoordinates}`,
        ]);
      }, 500);
    }
  }, [
    params.analysisId,
    params.species,
    params.imageUrl,
    params.weight,
    params.catchId,
    params.catchDate,
    params.catchWeight,
    params.zoneName,
    params.zoneCoordinates,
    params.markerType,
    params.markerCoordinates,
  ]);

  useEffect(() => {
    // Load conversations from AsyncStorage first, then sync with backend
    loadStoredConversations().then(() => {
      // Sync with backend when online
      syncConversations();
    });
  }, []);

  // Sync conversations when coming back online
  useEffect(() => {
    if (effectiveMode === "online") {
      syncConversations();
    }
  }, [effectiveMode]);

  useEffect(() => {
    Animated.timing(sidebarAnim, {
      toValue: showSidebar ? 0 : -SCREEN_WIDTH * 0.75,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [showSidebar]);

  // Animated typing dots
  useEffect(() => {
    if (!isTyping && !isStreaming) {
      dot1Anim.setValue(0);
      dot2Anim.setValue(0);
      dot3Anim.setValue(0);
      return;
    }
    const makeBounce = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: -6,
            duration: 260,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 260,
            useNativeDriver: true,
          }),
          Animated.delay(Math.max(0, 780 - delay - 520)),
        ]),
      );
    const a1 = makeBounce(dot1Anim, 0);
    const a2 = makeBounce(dot2Anim, 140);
    const a3 = makeBounce(dot3Anim, 280);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [isTyping, isStreaming]);

  const speakMessage = async (text: string) => {
    if (isSpeaking) {
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
      }
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    try {
      const res = await synthesizeSpeech(text, speechCode || "en-IN");
      if (res.audioBase64) {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: `data:audio/mp3;base64,${res.audioBase64}` },
          { shouldPlay: true },
        );
        setSound(newSound);
        newSound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.true && status.didJustFinish) {
            setIsSpeaking(false);
            newSound.unloadAsync();
            setSound(null);
          }
        });
      } else {
        setIsSpeaking(false);
      }
    } catch (error) {
      console.warn("TTS Error:", error);
      setIsSpeaking(false);
    }
  };

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  const loadChat = async (chatId: string) => {
    setCurrentChatId(chatId);
    setShowSidebar(false);
    setMessages([]);
    setIsTyping(true);
    if (sound) {
      sound.unloadAsync();
      setSound(null);
    }
    setIsSpeaking(false);
    try {
      const { getChatHistory } = await import("../../lib/api-client");
      const history = await getChatHistory(50, chatId);
      const formatted = history.map((msg) => ({
        id: msg.id,
        role: msg.role as "user" | "assistant",
        text: msg.role === "assistant" ? sanitiseAgentText(msg.text) : msg.text,
        timestamp: new Date(msg.timestamp),
      }));
      setMessages(
        formatted.length > 0
          ? formatted
          : [
              {
                id: "welcome",
                role: "assistant",
                text: t("chat.welcome"),
                timestamp: new Date(),
              },
            ],
      );
    } catch (e) {
      console.warn(e);
    } finally {
      setIsTyping(false);
    }
  };

  const createNewChat = () => {
    setCurrentChatId(null);
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        text: t("chat.welcome"),
        timestamp: new Date(),
      },
    ]);
    setShowSidebar(false);
    Speech.stop();
    setIsSpeaking(false);
    setReplyingTo(null);
    setReferencedAnalysis(null);
  };

  const handleReply = (message: UIMessage) => {
    setReplyingTo(message);
    // Focus the input (on mobile this will show the keyboard)
  };

  const handleSelectAnalysis = (
    analysisId: string,
    imageUrl: string,
    species?: string,
  ) => {
    setReferencedAnalysis({
      id: analysisId,
      imageUrl,
      species,
      type: "single",
    });
  };

  const handleSelectGroup = (groupId: string, groupName: string) => {
    setReferencedAnalysis({
      id: groupId,
      imageUrl: "", // Groups don't have a single image URL in this context
      species: groupName,
      type: "group",
    });
  };

  const handleWeightResult = (weightG: number) => {
    setWeightModalVisible(false);
    const kgStr = (weightG / 1000).toFixed(2);
    sendMessage(
      `I just measured a ${weightSpecies} and the on-device model estimated its weight at ${kgStr} kg (${weightG.toFixed(0)}g). What's the current market value for this? Any quality or storage recommendations?`,
    );
  };

  const handleTipPress = (action: string) => {
    if (!selectedTips.includes(action)) {
      setSelectedTips((prev) => [...prev, action]);
    }
  };

  const removeTip = (action: string) => {
    setSelectedTips((prev) => prev.filter((tip) => tip !== action));
  };

  const handleCapabilityPress = (cap: AgentCapability) => {
    if (cap.action === "openCamera") {
      router.push("/(tabs)/upload");
    } else if (cap.action === "openWeightEstimator") {
      setGroupFishPickerVisible(true);
    } else if (cap.prompt) {
      if (!selectedTips.includes(cap.prompt)) {
        setSelectedTips((prev) => [...prev, cap.prompt!]);
      }
    }
  };

  const deleteChat = async (chatId: string) => {
    Alert.alert(
      t("chat.deleteTitle") || "Delete Conversation",
      t("chat.deleteMessage") ||
        "Are you sure you want to delete this conversation? This action cannot be undone.",
      [
        {
          text: t("common.cancel") || "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // Delete from backend if online
              if (effectiveMode === "online") {
                const { deleteConversation } =
                  await import("../../lib/api-client");
                await deleteConversation(chatId);
              }

              // Remove from local state
              const updatedChats = chats.filter((c) => c.id !== chatId);
              setChats(updatedChats);
              await persistConversations(updatedChats);

              // If deleted chat was active, create new chat
              if (currentChatId === chatId) {
                createNewChat();
              }
            } catch (error) {
              console.warn("Failed to delete conversation:", error);
              Alert.alert(
                t("common.error") || "Error",
                t("chat.deleteError") ||
                  "Failed to delete conversation. Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  const exportConversation = async () => {
    if (messages.length === 0) {
      Alert.alert(
        "No Messages",
        "There are no messages to export in this conversation.",
      );
      return;
    }

    try {
      // Show format selection
      Alert.alert("Export Conversation", "Choose export format:", [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Text File",
          onPress: () => exportAsText(),
        },
        {
          text: "JSON File",
          onPress: () => exportAsJSON(),
        },
      ]);
    } catch (error) {
      console.error("Failed to export conversation:", error);
      Alert.alert(
        "Export Failed",
        "Failed to export conversation. Please try again.",
      );
    }
  };

  const exportAsText = async () => {
    try {
      // Generate text content
      const conversationTitle = currentChatId
        ? chats.find((c) => c.id === currentChatId)?.title || "Chat Export"
        : "Chat Export";

      let textContent = `${conversationTitle}\n`;
      textContent += `Exported: ${new Date().toLocaleString()}\n`;
      textContent += `Total Messages: ${messages.length}\n`;
      textContent += `${"=".repeat(50)}\n\n`;

      messages.forEach((msg) => {
        const timestamp = new Date(msg.timestamp).toLocaleString();
        const role = msg.role === "user" ? "You" : "Assistant";

        textContent += `[${timestamp}] ${role}:\n`;

        // Add reply context if present
        if (msg.replyTo) {
          textContent += `  (Replying to ${msg.replyTo.role === "user" ? "You" : "Assistant"}: "${msg.replyTo.text.substring(0, 50)}...")\n`;
        }

        // Add referenced analysis if present
        if (msg.referencedAnalysis) {
          textContent += `  (Referenced Analysis: ${msg.referencedAnalysis.species || "Unknown"})\n`;
        }

        textContent += `${msg.text}\n\n`;
      });

      // Create file
      const fileName = `chat-export-${Date.now()}.txt`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, textContent);

      // Share file
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/plain",
          dialogTitle: "Export Conversation",
        });
      } else {
        Alert.alert("Export Complete", `Conversation exported to: ${fileUri}`);
      }

      // Cleanup after 5 minutes
      setTimeout(
        async () => {
          try {
            const fileInfo = await FileSystem.getInfoAsync(fileUri);
            if (fileInfo.exists) {
              await FileSystem.deleteAsync(fileUri, { idempotent: true });
            }
          } catch (error) {
            console.warn("Failed to cleanup temp file:", error);
          }
        },
        5 * 60 * 1000,
      );
    } catch (error) {
      console.error("Failed to export as text:", error);
      Alert.alert(
        "Export Failed",
        "Failed to export conversation as text. Please try again.",
      );
    }
  };

  const exportAsJSON = async () => {
    try {
      // Generate JSON content
      const conversationTitle = currentChatId
        ? chats.find((c) => c.id === currentChatId)?.title || "Chat Export"
        : "Chat Export";

      const exportData = {
        title: conversationTitle,
        conversationId: currentChatId,
        exportedAt: new Date().toISOString(),
        messageCount: messages.length,
        messages: messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.text,
          timestamp: msg.timestamp.toISOString(),
          replyTo: msg.replyTo
            ? {
                id: msg.replyTo.id,
                role: msg.replyTo.role,
                content: msg.replyTo.text,
              }
            : undefined,
          referencedAnalysis: msg.referencedAnalysis
            ? {
                id: msg.referencedAnalysis.id,
                species: msg.referencedAnalysis.species,
                type: msg.referencedAnalysis.type,
              }
            : undefined,
        })),
      };

      const jsonContent = JSON.stringify(exportData, null, 2);

      // Create file
      const fileName = `chat-export-${Date.now()}.json`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, jsonContent);

      // Share file
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "application/json",
          dialogTitle: "Export Conversation",
        });
      } else {
        Alert.alert("Export Complete", `Conversation exported to: ${fileUri}`);
      }

      // Cleanup after 5 minutes
      setTimeout(
        async () => {
          try {
            const fileInfo = await FileSystem.getInfoAsync(fileUri);
            if (fileInfo.exists) {
              await FileSystem.deleteAsync(fileUri, { idempotent: true });
            }
          } catch (error) {
            console.warn("Failed to cleanup temp file:", error);
          }
        },
        5 * 60 * 1000,
      );
    } catch (error) {
      console.error("Failed to export as JSON:", error);
      Alert.alert(
        "Export Failed",
        "Failed to export conversation as JSON. Please try again.",
      );
    }
  };

  const handleOpenTelegram = async () => {
    // Show the integration modal first
    setShowTelegramModal(true);
  };

  const openTelegramApp = async () => {
    try {
      await DeepLinkService.openTelegramBot(
        user?.userId,
        userLocation?.latitude,
        userLocation?.longitude,
      );
    } catch (error) {
      console.error("Failed to open Telegram:", error);
      Alert.alert("Error", "Failed to open Telegram. Please try again.");
    }
  };

  const sendMessage = async (text: string) => {
    const parts = [...selectedTips];
    if (text.trim()) {
      parts.push(text.trim());
    }
    const finalMessage = parts.join("\n\n");
    const trimmed = finalMessage.trim();

    if (!trimmed || isTyping || isStreaming) return;

    Speech.stop();
    setIsSpeaking(false);
    setInputText("");
    setSelectedTips([]);
    Keyboard.dismiss();

    const userMsg: UIMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      text: trimmed,
      timestamp: new Date(),
      replyTo: replyingTo
        ? {
            id: replyingTo.id,
            text: replyingTo.text,
            role: replyingTo.role,
          }
        : undefined,
      referencedAnalysis: referencedAnalysis || undefined,
    };
    setMessages((prev) => [...prev, userMsg]);

    // Clear reply and analysis context after sending
    setReplyingTo(null);
    const analysisIdToSend = referencedAnalysis?.id;
    setReferencedAnalysis(null);

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    // Create conversation if needed
    let targetChatId = currentChatId;
    if (!targetChatId) {
      try {
        const { createConversation } = await import("../../lib/api-client");
        const newConv = await createConversation(
          trimmed.substring(0, 40),
          locale,
        );
        targetChatId = newConv.conversationId;
        setCurrentChatId(targetChatId);
        if (targetChatId) {
          const newChat: StoredConversation = {
            id: targetChatId,
            title: trimmed.substring(0, 40),
            lastMessageTime: new Date().toISOString(),
          };
          const updatedChats = [newChat, ...chats];
          setChats(updatedChats);
          await persistConversations(updatedChats);
        }
      } catch (e) {
        console.warn("Failed to create conversation", e);
      }
    } else {
      // Update last message time for existing conversation
      const updatedChats = chats.map((c) =>
        c.id === targetChatId
          ? { ...c, lastMessageTime: new Date().toISOString() }
          : c,
      );
      setChats(updatedChats);
      await persistConversations(updatedChats);
    }

    // Try streaming first
    const botMsgId = `bot_${Date.now()}`;
    setStreamingMessageId(botMsgId);
    setIsStreaming(true);
    setLiveToolCalls([]);
    setLastSuggestions([]);

    // Add empty assistant message that will be filled with tokens
    const botMsg: UIMessage = {
      id: botMsgId,
      role: "assistant",
      text: "",
      timestamp: new Date(),
      toolsCalled: [],
    };
    setMessages((prev) => [...prev, botMsg]);

    let streamedText = "";
    let streamSuccess = false;
    let collectedToolCalls: string[] = [];

    try {
      await chatStreamClient.streamMessage({
        conversationId: targetChatId ?? undefined,
        message: trimmed,
        language: locale,
        location: userLocation ?? undefined,
        replyToMessageId: replyingTo?.id,
        analysisId: analysisIdToSend,
        onToken: (token: string) => {
          streamedText += token;
          // Sanitise during streaming so leaked JSON/noise is never shown
          const displayText = sanitiseAgentText(streamedText);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMsgId ? { ...msg, text: displayText } : msg,
            ),
          );
          setTimeout(
            () => flatListRef.current?.scrollToEnd({ animated: true }),
            50,
          );
        },
        onToolCall: (toolName: string) => {
          collectedToolCalls = [...collectedToolCalls, toolName];
          setLiveToolCalls([...collectedToolCalls]);
        },
        onComplete: (ui?: any) => {
          streamSuccess = true;
          setIsStreaming(false);
          setStreamingMessageId(null);
          setLiveToolCalls([]);
          // Sanitise final text - strip any leaked JSON/memory noise
          const cleanText = sanitiseAgentText(streamedText);
          // Update message with cleaned text, UI actions and tool calls
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMsgId
                ? {
                    ...msg,
                    text: cleanText,
                    uiActions: ui,
                    toolsCalled: collectedToolCalls,
                  }
                : msg,
            ),
          );
          // Generate suggestion chips
          setLastSuggestions(
            generateSuggestions(collectedToolCalls, cleanText),
          );
        },
        onError: (error) => {
          console.error("Streaming error:", error);
          setIsStreaming(false);
          setStreamingMessageId(null);
        },
      });

      if (streamSuccess) {
        return; // Streaming completed successfully
      }
    } catch (streamError: any) {
      if (streamError?.name === "AbortError") {
        return; // User cancelled, don't fall back to non-streaming
      }
      console.warn(
        "Streaming failed, falling back to non-streaming:",
        streamError,
      );
    }

    // Fallback to non-streaming if streaming failed
    setIsStreaming(false);
    setStreamingMessageId(null);
    setIsTyping(true);

    // Remove the empty streaming message
    setMessages((prev) => prev.filter((msg) => msg.id !== botMsgId));

    try {
      const { sendChat } = await import("../../lib/api-client");

      const res = await sendChat(
        trimmed,
        targetChatId ?? undefined,
        locale,
        userLocation ?? undefined,
        replyingTo?.id,
        analysisIdToSend,
      );

      if (!targetChatId && res.chatId) {
        setCurrentChatId(res.chatId);
        const newChat: StoredConversation = {
          id: res.chatId,
          title: trimmed,
          lastMessageTime: new Date().toISOString(),
        };
        const updatedChats = [newChat, ...chats];
        setChats(updatedChats);
        await persistConversations(updatedChats);
      }

      const fallbackBotMsg: UIMessage = {
        id: `bot_${Date.now()}`,
        role: "assistant",
        text: sanitiseAgentText(res.response),
        timestamp: new Date(res.timestamp),
      };
      setMessages((prev) => [...prev, fallbackBotMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          text: t("common.error"),
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        150,
      );
    }
  };

  const renderMessage = ({ item }: { item: UIMessage }) => {
    const isUser = item.role === "user";

    // The hub greeting replaces the welcome message when the empty state is shown
    if (item.id === "welcome" && isEmptyChat) return null;

    // Don't render the placeholder bubble while waiting for the first token -
    // the typing indicator in the footer already covers this state.
    if (!isUser && item.id === streamingMessageId && item.text === "") {
      return null;
    }

    const renderRightActions = (
      progress: Animated.AnimatedInterpolation<number>,
    ) => {
      const scale = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0.5, 1],
        extrapolate: "clamp",
      });
      const opacity = progress.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, 0.6, 1],
        extrapolate: "clamp",
      });
      return (
        <Animated.View
          className="justify-center items-center w-14 pr-2"
          style={{ opacity, transform: [{ scale }] }}
        >
          <View className="w-[34px] h-[34px] rounded-full bg-bgCard border border-borderDark items-center justify-center">
            <Ionicons name="arrow-undo" size={17} color={COLORS.primaryLight} />
          </View>
        </Animated.View>
      );
    };

    return (
      <Swipeable
        ref={(ref) => {
          if (ref) swipeableRefs.current.set(item.id, ref);
          else swipeableRefs.current.delete(item.id);
        }}
        renderRightActions={renderRightActions}
        overshootRight={false}
        friction={2.2}
        rightThreshold={50}
        onSwipeableOpen={() => {
          handleReply(item);
          setTimeout(() => swipeableRefs.current.get(item.id)?.close(), 180);
        }}
      >
        <View
          className={`px-4 py-[6px] flex-row items-start ${isUser ? "justify-end" : "gap-[10px]"}`}
        >
          {/* Bot avatar */}
          {!isUser && (
            <View className="w-[30px] h-[30px] rounded-[10px] bg-primary/25 border-[1.5px] border-primaryLight/40 items-center justify-center mt-0.5 shrink-0">
              <Ionicons
                name="hardware-chip-outline"
                size={15}
                color={COLORS.primaryLight}
              />
            </View>
          )}

          <View
            className={`max-w-[78%] shrink ${isUser ? "bg-primary rounded-[18px] rounded-br-[4px] px-[14px] pt-2.5 pb-2 shadow-sm shadow-primaryLight/15 elevation-3" : "flex-1"}`}
          >
            {/* Reply context */}
            {item.replyTo && (
              <View
                className={`bg-white/5 rounded-lg px-2.5 py-1.5 mb-1.5 border-l-2 border-primaryLight ${isUser ? "bg-white/10" : ""}`}
              >
                <View className="flex-1">
                  <Text className="text-[11px] font-semibold text-primaryLight mb-[1px]">
                    {item.replyTo.role === "user" ? "You" : "Assistant"}
                  </Text>
                  <Text
                    className="text-[11px] text-textMuted leading-[15px]"
                    numberOfLines={2}
                  >
                    {item.replyTo.text}
                  </Text>
                </View>
              </View>
            )}

            {/* Analysis reference */}
            {item.referencedAnalysis && (
              <View className="flex-row items-center bg-white/5 rounded-lg px-2.5 py-1.5 mb-1.5 border-l-2 border-primaryLight gap-2">
                {item.referencedAnalysis.imageUrl ? (
                  <Image
                    source={{ uri: item.referencedAnalysis.imageUrl }}
                    className="w-9 h-9 rounded-md bg-bgDark"
                  />
                ) : (
                  <View className="w-9 h-9 rounded-md bg-bgDark justify-center items-center">
                    <Ionicons
                      name="images"
                      size={18}
                      color={COLORS.primaryLight}
                    />
                  </View>
                )}
                <View className="flex-1">
                  <Text className="text-[11px] font-semibold text-primaryLight mb-[1px]">
                    Referenced Analysis
                  </Text>
                  <Text
                    className="text-[11px] text-textMuted"
                    numberOfLines={1}
                  >
                    {item.referencedAnalysis.species || "Unknown"}
                  </Text>
                </View>
              </View>
            )}

            {/* Message text */}
            {isUser ? (
              <Text className="text-[#e0ecff] text-[14px] leading-[21px]">
                {item.text}
              </Text>
            ) : (
              <StreamingText
                text={item.text}
                isStreaming={streamingMessageId === item.id}
                markdownStyles={markdownStyles}
                plainStyle={markdownStyles.body}
              />
            )}

            {/* Inline UI widgets from agent response */}
            {!isUser &&
              item.uiActions?.map &&
              item.uiActions.mapLat &&
              item.uiActions.mapLon && (
                <InlineMapWidget
                  latitude={item.uiActions.mapLat}
                  longitude={item.uiActions.mapLon}
                  onSendLocation={(lat, lon) => {
                    setSelectedTips((prev) => [
                      ...prev,
                      `Fishing conditions at ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`,
                    ]);
                  }}
                />
              )}
            {!isUser && item.uiActions?.history && (
              <InlineCatchCarousel
                onAskAboutCatch={(groupId, species) => {
                  setSelectedTips((prev) => [
                    ...prev,
                    `My ${species} catch (group ${groupId})`,
                  ]);
                }}
              />
            )}
            {!isUser && item.uiActions?.upload && <InlineUploadCard />}

            {/* Scan result card */}
            {!isUser && item.scanResult && (
              <ScanResultCard
                fishCount={item.scanResult.fishCount}
                detections={item.scanResult.detections}
                totalValue={item.scanResult.totalValue}
                onAction={(action) => {
                  if (action === "ask") {
                    setSelectedTips((prev) => [
                      ...prev,
                      `Latest scan with ${item.scanResult!.fishCount} fish`,
                    ]);
                  } else if (action === "buyers") {
                    setSelectedTips((prev) => [
                      ...prev,
                      `Find buyers for this catch`,
                    ]);
                  } else if (action === "compare") {
                    setSelectedTips((prev) => [
                      ...prev,
                      `Compare selling prices for this catch`,
                    ]);
                  }
                }}
              />
            )}

            {/* Tool transparency badge (collapsed) */}
            {!isUser &&
              item.toolsCalled &&
              item.toolsCalled.length > 0 &&
              streamingMessageId !== item.id && (
                <ToolsBadge count={item.toolsCalled.length} />
              )}

            {/* Footer */}
            <View
              className={`flex-row items-center mt-1 gap-2 ${isUser ? "justify-end" : ""}`}
            >
              {!isUser && (
                <TouchableOpacity
                  onPress={() => speakMessage(item.text)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  className="p-0.5"
                >
                  <Ionicons
                    name={isSpeaking ? "volume-mute" : "volume-high"}
                    size={13}
                    color={COLORS.textSubtle}
                  />
                </TouchableOpacity>
              )}
              <Text
                className={`text-[10px] text-textSubtle ${isUser ? "text-[#bfdbfe]/55" : ""}`}
              >
                {item.timestamp.toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </View>
        </View>
      </Swipeable>
    );
  };

  if (!true) return null;

  const isEmptyChat = messages.length <= 1;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
        {/* Offline overlay */}
        {effectiveMode === "offline" && (
          <View className="absolute top-0 left-0 right-0 bottom-0 bg-[#0f172a]/95 z-[1000] justify-center items-center p-8">
            <View className="bg-bgCard rounded-2xl p-7 items-center max-w-[300px] border border-borderDark">
              <Ionicons
                name={false ? "speedometer-outline" : "cloud-offline"}
                size={44}
                color={COLORS.warning}
              />
              <Text className="text-[15px] font-semibold text-textPrimary mt-3 mb-1.5">
                {false ? "Slow Connection" : "No Internet Connection"}
              </Text>
              <Text className="text-[13px] text-textMuted text-center leading-[19px]">
                {false
                  ? "AI Assistant requires a stable internet connection."
                  : "AI Assistant requires an active internet connection to function."}
              </Text>
            </View>
          </View>
        )}

        {/* Sidebar Modal */}
        <Modal
          visible={showSidebar}
          transparent
          animationType="none"
          onRequestClose={() => setShowSidebar(false)}
        >
          <TouchableOpacity
            className="flex-1 bg-black/55"
            activeOpacity={1}
            onPress={() => setShowSidebar(false)}
          >
            <Animated.View
              className="absolute left-0 top-0 bottom-0 w-[78%] bg-bgDark border-r-[0.5px] border-borderDark pt-[54px]"
              style={{ transform: [{ translateX: sidebarAnim }] }}
              onStartShouldSetResponder={() => true}
            >
              <View className="flex-row justify-between items-center px-4 pb-3.5 border-b-[0.5px] border-borderDark">
                <Text className="text-[14px] font-bold text-textPrimary tracking-[0.3px]">
                  Conversations
                </Text>
                <TouchableOpacity
                  onPress={() => setShowSidebar(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={22} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                className="flex-row items-center justify-center bg-primary mx-4 mt-3.5 mb-2.5 py-2.5 rounded-lg gap-1.5"
                onPress={createNewChat}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text className="text-white text-[13px] font-semibold">
                  New Chat
                </Text>
              </TouchableOpacity>

              <ScrollView
                className="flex-1 px-2.5 pt-1.5"
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshingSidebar}
                    onRefresh={handleRefreshSidebar}
                    tintColor={COLORS.primary}
                    colors={[COLORS.primary]}
                  />
                }
              >
                {chats.length === 0 ? (
                  <View className="items-center justify-center py-12 px-6">
                    <Ionicons
                      name="chatbubbles-outline"
                      size={40}
                      color={COLORS.textSubtle}
                    />
                    <Text className="text-[14px] font-semibold text-textPrimary mt-3 mb-1 text-center">
                      No Conversations Yet
                    </Text>
                    <Text className="text-[12px] text-textMuted text-center leading-[18px]">
                      Start chatting for fishing advice, market insights, and
                      catch analysis.
                    </Text>
                  </View>
                ) : (
                  chats.map((chat) => (
                    <View
                      key={chat.id}
                      className={`flex-row items-center justify-between py-2.5 px-2.5 rounded-lg mb-0.5 ${currentChatId === chat.id ? "bg-primary/10 border border-primary/40" : ""}`}
                    >
                      <TouchableOpacity
                        className="flex-row items-center gap-2.5 flex-1"
                        onPress={() => loadChat(chat.id)}
                      >
                        <Ionicons
                          name="chatbubble-outline"
                          size={16}
                          color={
                            currentChatId === chat.id
                              ? COLORS.primaryLight
                              : COLORS.textSubtle
                          }
                        />
                        <View className="flex-1">
                          <Text
                            className={`text-textSecondary text-[13px] leading-[18px] ${currentChatId === chat.id ? "text-primaryLight font-semibold" : ""}`}
                            numberOfLines={1}
                          >
                            {chat.title}
                          </Text>
                          <Text className="text-textSubtle text-[10px] mt-0.5">
                            {formatTimestamp(chat.lastMessageTime)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="p-1.5"
                        onPress={() => deleteChat(chat.id)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color={COLORS.textSubtle}
                        />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </ScrollView>
            </Animated.View>
          </TouchableOpacity>
        </Modal>

        {/* Analysis Picker Modal */}
        <AnalysisPicker
          visible={showAnalysisPicker}
          onClose={() => setShowAnalysisPicker(false)}
          onSelectAnalysis={handleSelectAnalysis}
          onSelectGroup={handleSelectGroup}
        />

        {/* Telegram Integration Modal */}
        <TelegramIntegrationModal
          visible={showTelegramModal}
          onClose={() => setShowTelegramModal(false)}
          onOpenTelegram={openTelegramApp}
        />

        {/* Weight Estimation Selection Picker */}
        <GroupFishPickerModal
          visible={groupFishPickerVisible}
          onClose={() => setGroupFishPickerVisible(false)}
          onSelectFish={(params) => {
            setGroupFishPickerVisible(false);
            setWeightSpecies(params.species);
            setWeightFishIndex(params.fishIndex);
            setWeightModalVisible(true);
          }}
        />

        {/* Weight Estimation Modal */}
        <WeightEstimateModal
          visible={weightModalVisible}
          onClose={() => setWeightModalVisible(false)}
          onConfirm={handleWeightResult}
          species={weightSpecies}
          fishIndex={weightFishIndex}
        />

        {/* ─── Header ─────────────────────────────────────── */}
        <View className="flex-row items-center h-[52px] px-3 border-b-[0.5px] border-borderDark bg-bgDark">
          <TouchableOpacity
            onPress={() => setShowSidebar(true)}
            className="w-[38px] h-[38px] rounded-[10px] items-center justify-center"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons
              name="menu-outline"
              size={22}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>

          <View className="flex-1 flex-row items-center justify-center gap-2">
            <View className="w-7 h-7 rounded-lg bg-primaryDark items-center justify-center">
              <Ionicons
                name="hardware-chip-outline"
                size={14}
                color={COLORS.primaryLight}
              />
            </View>
            <Text className="text-[15px] font-semibold text-textPrimary max-w-[45%]">
              {currentChatId
                ? chats.find((c) => c.id === currentChatId)?.title ||
                  "AI Assistant"
                : "New Chat"}
            </Text>
          </View>

          <View className="flex-row items-center gap-0.5">
            <TouchableOpacity
              onPress={handleOpenTelegram}
              className="w-[38px] h-[38px] rounded-[10px] items-center justify-center"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons
                name="paper-plane-outline"
                size={20}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={exportConversation}
              className="w-[38px] h-[38px] rounded-[10px] items-center justify-center"
              disabled={messages.length === 0}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons
                name="download-outline"
                size={20}
                color={
                  messages.length === 0
                    ? COLORS.textSubtle
                    : COLORS.textSecondary
                }
              />
            </TouchableOpacity>
            <ProfileMenu size={32} />
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
          keyboardVerticalOffset={0}
        >
          {/* ─── Message List ─────────────────────────────── */}
          {isTyping && messages.length === 0 ? (
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              <ChatSkeleton />
            </ScrollView>
          ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerClassName="pt-2 pb-3"
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
            ListHeaderComponent={
              isEmptyChat ? (
                <View className="px-4 pt-4 pb-2.5 bg-bgDark">
                  {/* Hero greeting */}
                  <View className="flex-row items-center mb-[14px] gap-3">
                    <View className="w-10 h-10 rounded-xl bg-primary items-center justify-center">
                      <Ionicons name="hardware-chip" size={20} color="#fff" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[16px] font-bold text-textPrimary tracking-[0.2px]">
                        {greeting}, {user?.name ?? "Captain"}
                      </Text>
                      <Text className="text-[12px] text-textMuted mt-[1px]">
                        What can I help you with?
                      </Text>
                    </View>
                  </View>

                  {/* Capability grid */}
                  <View className="flex-row flex-wrap justify-between mb-2">
                    {AGENT_CAPABILITIES.map((cap) => (
                      <TouchableOpacity
                        key={cap.label}
                        className="bg-bgCard rounded-[20px] border border-borderDark p-4 items-start mb-3"
                        style={{ width: "48%", minHeight: 125 }}
                        onPress={() => handleCapabilityPress(cap)}
                        activeOpacity={0.7}
                        disabled={isTyping || isStreaming}
                      >
                        <View
                          className="w-[30px] h-[30px] rounded-2xl items-center justify-center mb-3"
                          style={{ backgroundColor: cap.color + "18" }}
                        >
                          <Ionicons
                            name={cap.icon}
                            size={22}
                            color={cap.color}
                          />
                        </View>
                        <Text
                          className="text-[14px] font-bold text-textPrimary mb-1"
                          numberOfLines={1}
                        >
                          {cap.label}
                        </Text>
                        <Text
                          className="text-[11.5px] text-[#8c8c8c] leading-[16px]"
                          numberOfLines={2}
                        >
                          {cap.desc}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null
            }
            ListFooterComponent={
              <>
                {/* Live tool transparency during streaming */}
                {isStreaming && liveToolCalls.length > 0 && (
                  <View style={{ paddingHorizontal: 56 }}>
                    <ToolTransparency
                      toolsCalled={liveToolCalls}
                      isWorking={isStreaming}
                    />
                  </View>
                )}

                {/* Typing / Streaming indicator */}
                {(isTyping || isStreaming) &&
                  (() => {
                    const streamingMsg = messages.find(
                      (m) => m.id === streamingMessageId,
                    );
                    const hasContent = Boolean(streamingMsg?.text);
                    // Once tokens are flowing the ▌ cursor in the bubble signals
                    // progress - only show the stop button, not the typing dots.
                    const showDots = isTyping || !hasContent;
                    return (
                      <View className="flex-row items-center gap-2.5 px-4 py-2">
                        <View className="w-[30px] h-[30px] rounded-[10px] bg-primary/25 border-[1.5px] border-primaryLight/40 items-center justify-center mt-0.5 shrink-0">
                          <Ionicons
                            name="hardware-chip-outline"
                            size={15}
                            color={COLORS.primaryLight}
                          />
                        </View>
                        {showDots && (
                          <View className="flex-row items-center gap-2 bg-bgCard rounded-[14px] px-[14px] py-2.5 border border-borderDark">
                            <View className="flex-row items-center gap-1">
                              <Animated.View
                                className="w-1.5 h-1.5 rounded-full bg-primaryLight"
                                style={{
                                  transform: [{ translateY: dot1Anim }],
                                }}
                              />
                              <Animated.View
                                className="w-1.5 h-1.5 rounded-full bg-primaryLight"
                                style={{
                                  transform: [{ translateY: dot2Anim }],
                                }}
                              />
                              <Animated.View
                                className="w-1.5 h-1.5 rounded-full bg-primaryLight"
                                style={{
                                  transform: [{ translateY: dot3Anim }],
                                }}
                              />
                            </View>
                            <Text className="text-textMuted text-[12px]">
                              {isStreaming ? "Generating..." : t("chat.typing")}
                            </Text>
                          </View>
                        )}
                        {isStreaming && (
                          <TouchableOpacity
                            className="p-1 ml-0.5"
                            onPress={() => {
                              chatStreamClient.stopStreaming();
                              setIsStreaming(false);
                              if (streamingMessageId) {
                                setMessages((prev) =>
                                  prev.map((msg) =>
                                    msg.id === streamingMessageId
                                      ? {
                                          ...msg,
                                          text:
                                            msg.text +
                                            (msg.text ? "\n\n" : "") +
                                            "*You stopped this response*",
                                        }
                                      : msg,
                                  ),
                                );
                              }
                              setStreamingMessageId(null);
                            }}
                          >
                            <Ionicons
                              name="stop-circle"
                              size={22}
                              color={COLORS.error}
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })()}
                {/* Contextual suggestion chips */}
                {!isTyping &&
                  !isStreaming &&
                  lastSuggestions.length > 0 &&
                  messages.length > 2 && (
                    <SuggestionChips
                      suggestions={lastSuggestions}
                      onSelect={(prompt) => sendMessage(prompt)}
                      disabled={isTyping || isStreaming}
                    />
                  )}
              </>
            }
          />
          )}

          {/* ─── Input Bar ────────────────────────────────── */}
          {isEmptyChat && (
            <View className="bg-bgDark">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-2 max-h-[38px] px-3"
                contentContainerClassName="gap-2 pr-6"
                keyboardShouldPersistTaps="always"
              >
                {QUICK_ACTIONS.map((action) => (
                  <TouchableOpacity
                    key={action}
                    className="flex-row items-center bg-bgCard rounded-full border border-borderDark px-3 py-1.5 gap-[5px]"
                    onPress={() => handleTipPress(action)}
                    activeOpacity={0.7}
                    disabled={
                      isTyping || isStreaming || selectedTips.includes(action)
                    }
                  >
                    <Ionicons
                      name="sparkles"
                      size={14}
                      color={
                        selectedTips.includes(action)
                          ? COLORS.textSubtle
                          : COLORS.primaryLight
                      }
                    />
                    <Text
                      className={`text-[13px] font-medium ${selectedTips.includes(action) ? "text-textSubtle" : "text-textSecondary"}`}
                    >
                      {action}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View className="bg-bgDark px-3 pt-2 pb-2.5 border-t-[0.5px] border-borderDark">
            {/* Context Box for Tips */}
            {selectedTips.length > 0 && (
              <View className="flex-row items-center bg-bgCard rounded-lg px-3 py-2 mb-1.5 gap-2 flex-wrap">
                <View className="w-[3px] h-full bg-primaryLight rounded-sm absolute left-0 top-0 bottom-0" />
                <View className="flex-1 flex-row flex-wrap gap-1.5 pl-1">
                  {selectedTips.map((tip, idx) => (
                    <View
                      key={idx}
                      className="bg-primary/20 rounded-full px-2.5 py-1.5 flex-row items-center gap-1.5 border border-primary/30"
                    >
                      <Ionicons
                        name="sparkles"
                        size={12}
                        color={COLORS.primaryLight}
                      />
                      <Text
                        className="text-[12px] text-primaryLight font-medium"
                        numberOfLines={1}
                      >
                        {tip.length > 35 ? tip.substring(0, 35) + "..." : tip}
                      </Text>
                      <TouchableOpacity
                        onPress={() => removeTip(tip)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name="close-circle"
                          size={16}
                          color={COLORS.primaryLight}
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Reply preview */}
            {replyingTo && (
              <View className="flex-row items-center bg-bgCard rounded-lg px-3 py-2 mb-1.5 gap-2">
                <View className="w-[3px] h-full bg-primaryLight rounded-sm absolute left-0 top-0 bottom-0" />
                <View className="flex-1 flex-row items-center gap-2 pl-1">
                  <Ionicons
                    name="arrow-undo"
                    size={14}
                    color={COLORS.primaryLight}
                  />
                  <View className="flex-1">
                    <Text className="text-[11px] font-semibold text-primaryLight mb-[1px]">
                      Replying to{" "}
                      {replyingTo.role === "user" ? "yourself" : "Assistant"}
                    </Text>
                    <Text
                      className="text-[11px] text-textMuted"
                      numberOfLines={1}
                    >
                      {replyingTo.text}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setReplyingTo(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={18} color={COLORS.textSubtle} />
                </TouchableOpacity>
              </View>
            )}

            {/* Analysis reference preview */}
            {referencedAnalysis && (
              <View className="flex-row items-center bg-bgCard rounded-lg px-3 py-2 mb-1.5 gap-2">
                <View className="w-[3px] h-full bg-primaryLight rounded-sm absolute left-0 top-0 bottom-0" />
                <View className="flex-1 flex-row items-center gap-2 pl-1">
                  {referencedAnalysis.imageUrl ? (
                    <Image
                      source={{ uri: referencedAnalysis.imageUrl }}
                      className="w-8 h-8 rounded-md bg-bgSurface"
                    />
                  ) : (
                    <View className="w-8 h-8 rounded-md bg-bgSurface justify-center items-center">
                      <Ionicons
                        name="fish"
                        size={14}
                        color={COLORS.primaryLight}
                      />
                    </View>
                  )}
                  <View className="flex-1">
                    <Text className="text-[11px] font-semibold text-primaryLight mb-[1px]">
                      Referencing Analysis
                    </Text>
                    <Text
                      className="text-[11px] text-textMuted"
                      numberOfLines={1}
                    >
                      {referencedAnalysis.species || "Unknown"}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setReferencedAnalysis(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={18} color={COLORS.textSubtle} />
                </TouchableOpacity>
              </View>
            )}

            {/* Action bar - quick context tools */}
            {!isEmptyChat && (
              <View className="flex-row items-center justify-center gap-1 mb-2">
                <TouchableOpacity
                  className="w-9 h-8 rounded-lg bg-bgCard border border-borderDark items-center justify-center"
                  onPress={() => setShowAnalysisPicker(true)}
                  disabled={isTyping || isStreaming}
                >
                  <Ionicons
                    name="fish-outline"
                    size={18}
                    color={COLORS.primaryLight}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  className="w-9 h-8 rounded-lg bg-bgCard border border-borderDark items-center justify-center"
                  onPress={() => router.push("/(tabs)/upload")}
                >
                  <Ionicons
                    name="camera-outline"
                    size={18}
                    color={COLORS.primaryLight}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  className="w-9 h-8 rounded-lg bg-bgCard border border-borderDark items-center justify-center"
                  onPress={() => setGroupFishPickerVisible(true)}
                >
                  <Ionicons
                    name="scale-outline"
                    size={18}
                    color={COLORS.primaryLight}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  className="w-9 h-8 rounded-lg bg-bgCard border border-borderDark items-center justify-center"
                  onPress={() =>
                    sendMessage(
                      "Show me my recent catch analytics and earnings summary.",
                    )
                  }
                  disabled={isTyping || isStreaming}
                >
                  <Ionicons
                    name="bar-chart-outline"
                    size={18}
                    color={COLORS.primaryLight}
                  />
                </TouchableOpacity>
              </View>
            )}

            {/* Input row */}
            <View className="flex-row items-end gap-2">
              <View className="flex-1 flex-row items-end bg-bgCard rounded-3xl border border-borderDark pl-2 pr-2 py-1 min-h-[44px]">
                <TouchableOpacity
                  className="w-[36px] h-[36px] items-center justify-center mb-[1px]"
                  onPress={isListening ? stopListening : startListening}
                  disabled={isTyping || isStreaming}
                >
                  <Ionicons
                    name={isListening ? "mic" : "mic-outline"}
                    size={22}
                    color={isListening ? COLORS.error : COLORS.textSubtle}
                  />
                </TouchableOpacity>

                <TextInput
                  className="flex-1 py-2 px-1 text-textPrimary text-[15px] max-h-[100px] leading-5"
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder={
                    isListening ? "Listening..." : t("chat.placeholder")
                  }
                  placeholderTextColor={
                    isListening ? COLORS.primary : COLORS.textSubtle
                  }
                  multiline
                  maxLength={1000}
                  returnKeyType="send"
                  onSubmitEditing={() => sendMessage(inputText)}
                />
              </View>

              <TouchableOpacity
                className={`w-[44px] h-[44px] rounded-full bg-primary items-center justify-center ${(!inputText.trim() && selectedTips.length === 0) || isTyping || isStreaming ? "opacity-50" : ""}`}
                onPress={() => sendMessage(inputText)}
                disabled={
                  (!inputText.trim() && selectedTips.length === 0) ||
                  isTyping ||
                  isStreaming
                }
                activeOpacity={0.75}
              >
                <Ionicons
                  name="send"
                  size={20}
                  color="#fff"
                  style={{ marginLeft: 3 }}
                />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

/* ═══════════════════════════════════════════════════════════
   Markdown Styles
   ═══════════════════════════════════════════════════════════ */
const markdownStyles = {
  body: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  heading1: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: "700" as const,
    marginTop: 12,
    marginBottom: 6,
  },
  heading2: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: "700" as const,
    marginTop: 10,
    marginBottom: 4,
  },
  heading3: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: "600" as const,
    marginTop: 8,
    marginBottom: 4,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 8,
  },
  strong: {
    fontWeight: "700" as const,
    color: COLORS.textPrimary,
  },
  em: {
    fontStyle: "italic" as const,
  },
  code_inline: {
    backgroundColor: "rgba(0,0,0,0.25)",
    color: COLORS.primaryLight,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: "monospace",
    fontSize: 12,
  },
  code_block: {
    backgroundColor: "rgba(0,0,0,0.25)",
    padding: 12,
    borderRadius: 8,
    marginVertical: 6,
    fontFamily: "monospace",
    fontSize: 12,
  },
  fence: {
    backgroundColor: "rgba(0,0,0,0.25)",
    padding: 12,
    borderRadius: 8,
    marginVertical: 6,
    fontFamily: "monospace",
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  bullet_list: {
    marginVertical: 4,
  },
  ordered_list: {
    marginVertical: 4,
  },
  list_item: {
    marginVertical: 2,
  },
  blockquote: {
    backgroundColor: "rgba(0,0,0,0.15)",
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primaryLight,
    paddingLeft: 10,
    paddingVertical: 4,
    marginVertical: 6,
  },
  link: {
    color: COLORS.primaryLight,
    textDecorationLine: "underline" as const,
  },
  table: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    marginVertical: 8,
  },
  thead: {
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  th: {
    padding: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontWeight: "700" as const,
  },
  td: {
    padding: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  hr: {
    backgroundColor: COLORS.border,
    height: 1,
    marginVertical: 12,
  },
};
