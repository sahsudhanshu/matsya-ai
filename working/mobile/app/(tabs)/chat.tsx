import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
import {
  synthesizeSpeech,
  type OnlineWeightResult,
} from "../../lib/api-client";
import { chatStreamClient } from "../../lib/chat-stream-client";
import { StreamingText } from "../../components/chat/StreamingText";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AnalysisPicker } from "../../components/chat/AnalysisPicker";
import { TelegramIntegrationModal } from "../../components/chat/TelegramIntegrationModal";
import { WeightEstimateModal } from "../../components/WeightEstimateModal";
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
import {
  FishPickerModal,
  type FishItem,
} from "../../components/chat/FishPickerModal";
import { GroupFishPickerModal } from "../../components/chat/GroupFishPickerModal";
import { useAgentContext } from "../../lib/agent-context";
import { getAnalysisData } from "../../lib/analysis-store";
import {
  sanitiseAgentText,
  stripContextTags,
} from "../../lib/chat-stream-client";
import type { AgentUIActions } from "../../lib/chat-stream-client";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CONVERSATIONS_STORAGE_KEY = "@chat/conversations";

interface UIMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
  replyTo?: { id: string; text: string; role: "user" | "assistant" };
  referencedAnalysis?: {
    id: string;
    imageUrl: string;
    species?: string;
    type: "single" | "group";
  };
  uiActions?: AgentUIActions;
  toolsCalled?: string[];
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
    icon: "sunny",
    label: "Daily Briefing",
    prompt:
      "Give me my daily fishing briefing - weather conditions, best fishing zones near me, today's market prices, and any active safety alerts for my area.",
    color: COLORS.secondary,
    desc: "Weather, zones & alerts",
  },
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
    icon: "analytics",
    label: "My Analytics",
    prompt:
      "Show me my catch analytics - total earnings, top species caught, quality grade breakdown, and recent trends.",
    color: "#7c3aed",
    desc: "Earnings & catch stats",
  },
  {
    icon: "navigate",
    label: "Fishing Zones",
    prompt:
      "What are the best fishing zones near me right now? Consider current weather, recent catch reports, and seasonal patterns.",
    color: COLORS.accent,
    desc: "Best spots near you",
  },
  {
    icon: "cash",
    label: "Market Prices",
    prompt:
      "What are today's market prices for fish in my area? Which species are trending up in price?",
    color: "#06b6d4",
    desc: "Real-time price intel",
  },
  {
    icon: "warning",
    label: "Safety Alerts",
    prompt:
      "Are there any active safety alerts, cyclone warnings, or dangerous weather conditions near my location?",
    color: "#ef4444",
    desc: "Warnings & advisories",
  },
  {
    icon: "leaf",
    label: "Sustainability",
    prompt:
      "How is my sustainability score? Am I within legal catch limits for my recently caught species?",
    color: "#10b981",
    desc: "Eco score & regulations",
  },
];

export default function ChatScreen() {
  const { user } = useAuth();
  const { t, locale, speechCode, isLoaded } = useLanguage();
  const { effectiveMode, connectionQuality } = useNetwork();
  const agentCtx = useAgentContext();
  const params = useLocalSearchParams();
  const navigation = useNavigation();

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  const QUICK_ACTIONS = [
    t("chat.actionFishToday"),
    t("chat.actionMarketPrices"),
    t("chat.actionOceanConditions"),
    t("chat.actionSustainability"),
    t("chat.actionRegulations"),
    t("chat.actionTips"),
  ];

  // ── State ─────────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<StoredConversation[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
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
  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [weightSpecies, setWeightSpecies] = useState("Tilapia");
  const [showGroupFishPicker, setShowGroupFishPicker] = useState(false);
  const [selectedGroupForWeight, setSelectedGroupForWeight] = useState<{
    groupId: string;
    source: "online" | "offline";
  } | null>(null);
  const [liveToolCalls, setLiveToolCalls] = useState<string[]>([]);
  const [lastSuggestions, setLastSuggestions] = useState<
    ReturnType<typeof generateSuggestions>
  >([]);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [refreshingChats, setRefreshingChats] = useState(false);

  // ── Scan → Chat weight estimation state ──
  const [isScanChat, setIsScanChat] = useState(false);
  const [isScanOffline, setIsScanOffline] = useState(false);
  const [scanFishList, setScanFishList] = useState<FishItem[]>([]);;
  const [fishWeights, setFishWeights] = useState<Map<number, number>>(
    new Map(),
  );
  const [showFishPicker, setShowFishPicker] = useState(false);
  const [weightFishIndex, setWeightFishIndex] = useState(0);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const flatListRef = useRef<FlatList>(null);
  const handledParamKey = useRef<string | null>(null);
  const sidebarAnim = useRef(new Animated.Value(-SCREEN_WIDTH * 0.75)).current;
  const swipeableRefs = useRef<Map<string, any>>(new Map());
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;
  const isSendingRef = useRef(false);
  const abortRef = useRef(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  // Hub shows when no user has sent any message yet
  const isEmptyChat = messages.filter((m) => m.role === "user").length === 0;

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    agentCtx.updateScreen("chat");
  }, []);

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
      } catch {}
    })();
  }, []);

  useEffect(() => {
    loadStoredConversations().then(() => syncConversations());
  }, []);

  useEffect(() => {
    if (effectiveMode === "online") syncConversations();
  }, [effectiveMode]);

  // Single consolidated params handler - guarded to prevent double-send
  useEffect(() => {
    const paramKey = [
      params.agentContext,
      params.initialMessage,
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
      params.scanComplete,
    ].join("|");

    if (!paramKey.replace(/\|/g, "").trim()) return;
    if (paramKey === handledParamKey.current) return;
    handledParamKey.current = paramKey;

    const run = async () => {
      if (params.agentContext) {
        createNewChat();
        await delay(300);
        sendMessage(params.agentContext as string);
        return;
      }
      // Scan → Chat: load fish list from analysis store and send summary
      if (params.scanComplete && params.initialMessage) {
        createNewChat();
        setIsScanChat(true);
        setIsScanOffline(params.scanMode !== "online");

        // Build fish list from analysis store
        const analysisData = getAnalysisData();
        const fishList: FishItem[] = [];

        if (analysisData?.mode === "online" && analysisData.groupAnalysis) {
          // Use detections if available, otherwise build from images[].crops
          let detections = analysisData.groupAnalysis.detections ?? [];
          if (detections.length === 0) {
            const built: typeof detections = [];
            for (const image of analysisData.groupAnalysis.images || []) {
              if (image.error) continue;
              for (const crop of Object.values(image.crops || {})) {
                built.push({
                  cropUrl: crop.crop_url || "",
                  species: crop.species?.label || "Unknown",
                  confidence: crop.species?.confidence || 0,
                  diseaseStatus: crop.disease?.label || "Healthy",
                  diseaseConfidence: crop.disease?.confidence || 0,
                  weight: 0,
                  value: 0,
                  gradcamUrls: {
                    species: crop.species?.gradcam_url || "",
                    disease: crop.disease?.gradcam_url || "",
                  },
                });
              }
            }
            detections = built;
          }
          detections.forEach((d, i) => {
            fishList.push({
              index: i,
              species: d.species,
              confidence: d.confidence,
              diseaseStatus: d.diseaseStatus,
              cropUrl: d.cropUrl,
              measuredWeightG: null,
            });
          });
        } else if (
          analysisData?.mode === "offline" &&
          analysisData.offlineResults
        ) {
          analysisData.offlineResults.forEach((d, i) => {
            fishList.push({
              index: i,
              species: d.species,
              confidence: d.speciesConfidence,
              diseaseStatus: d.disease,
              cropUrl: d.cropUri,
              measuredWeightG: d.weightUserEntered ? d.weightG : null,
            });
          });
        }

        setScanFishList(fishList);
        setFishWeights(new Map());

        await delay(300);
        sendMessage(params.initialMessage as string);
        return;
      }
      if (params.initialMessage) {
        createNewChat();
        await delay(300);
        sendMessage(params.initialMessage as string);
        return;
      }
      if (params.analysisId && params.species && params.imageUrl) {
        setReferencedAnalysis({
          id: params.analysisId as string,
          imageUrl: params.imageUrl as string,
          species: params.species as string,
          type: "single",
        });
        if (params.weight) {
          const weightG = parseFloat(params.weight as string);
          const kgStr = (weightG / 1000).toFixed(2);
          await delay(300);
          sendMessage(
            `I just analyzed a ${params.species} and the on-device model estimated its weight at ${kgStr} kg (${weightG.toFixed(0)}g). What is the current market value? Any quality or storage recommendations?`,
          );
        }
        return;
      }
      if (params.catchId && params.species) {
        setReferencedAnalysis({
          id: params.catchId as string,
          imageUrl: (params.catchImageUrl as string) || "",
          species: params.species as string,
          type: "single",
        });
        const catchDate = params.catchDate
          ? new Date(params.catchDate as string).toLocaleDateString()
          : "recently";
        const weightInfo = params.catchWeight
          ? ` weighing ${params.catchWeight}kg`
          : "";
        await delay(300);
        sendMessage(
          `I caught a ${params.species}${weightInfo} on ${catchDate}. Can you give me insights about this catch?`,
        );
        return;
      }
      if (params.zoneName && params.zoneCoordinates) {
        await delay(300);
        sendMessage(
          `Tell me about the fishing zone "${params.zoneName}" at coordinates ${params.zoneCoordinates}. What are the conditions, best species to target, and any regulations?`,
        );
        return;
      }
      if (params.markerType && params.markerCoordinates) {
        await delay(300);
        sendMessage(
          `I am looking at a ${params.markerType} marker at coordinates ${params.markerCoordinates}. What information can you provide about this location?`,
        );
      }
    };

    run();
  }, [
    params.agentContext,
    params.initialMessage,
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
    params.scanComplete,
  ]);

  useEffect(() => {
    Animated.timing(sidebarAnim, {
      toValue: showSidebar ? 0 : -SCREEN_WIDTH * 0.75,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [showSidebar]);

  useEffect(() => {
    if (!isTyping && !isStreaming) {
      dot1Anim.setValue(0);
      dot2Anim.setValue(0);
      dot3Anim.setValue(0);
      return;
    }
    const makeBounce = (anim: Animated.Value, d: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(d),
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
          Animated.delay(Math.max(0, 780 - d - 520)),
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

  useEffect(() => {
    return () => {
      sound?.unloadAsync();
    };
  }, [sound]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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
    return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  };

  const persistConversations = async (conversations: StoredConversation[]) => {
    try {
      await AsyncStorage.setItem(
        CONVERSATIONS_STORAGE_KEY,
        JSON.stringify(conversations),
      );
    } catch {}
  };

  const loadStoredConversations = async () => {
    try {
      const stored = await AsyncStorage.getItem(CONVERSATIONS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as StoredConversation[];
        setChats(parsed);
        return parsed;
      }
    } catch {}
    return [];
  };

  const syncConversations = async () => {
    if (effectiveMode === "offline") return;
    try {
      const { getConversationsList } = await import("../../lib/api-client");
      const list = await getConversationsList();
      const stored: StoredConversation[] = list.map((c) => ({
        id: c.conversationId,
        title: c.title,
        lastMessageTime: c.updatedAt,
      }));
      setChats(stored);
      await persistConversations(stored);
    } catch {}
  };

  const handleRefreshChats = async () => {
    setRefreshingChats(true);
    await syncConversations();
    setRefreshingChats(false);
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const createNewChat = useCallback(() => {
    setCurrentChatId(null);
    setMessages([]);
    setShowSidebar(false);
    setReplyingTo(null);
    setReferencedAnalysis(null);
    setLiveToolCalls([]);
    setLastSuggestions([]);
    setIsScanChat(false);
    setIsScanOffline(false);
    setScanFishList([]);
    setFishWeights(new Map());
    setShowFishPicker(false);
    Speech.stop();
    setIsSpeaking(false);
    sound?.unloadAsync();
    setSound(null);
  }, [sound]);

  const loadChat = async (chatId: string) => {
    setCurrentChatId(chatId);
    setShowSidebar(false);
    setMessages([]);
    setIsTyping(true);
    sound?.unloadAsync();
    setSound(null);
    setIsSpeaking(false);
    try {
      const { getChatHistory } = await import("../../lib/api-client");
      const history = await getChatHistory(50, chatId);
      const formatted: UIMessage[] = history.map((msg) => ({
        id: msg.id,
        role: msg.role as "user" | "assistant",
        text: msg.role === "assistant" ? sanitiseAgentText(msg.text) : msg.text,
        timestamp: new Date(msg.timestamp),
        uiActions: msg.uiActions,
      }));
      setMessages(formatted);
    } catch (e) {
      console.warn(e);
    } finally {
      setIsTyping(false);
    }
  };

  const handleReply = (message: UIMessage) => setReplyingTo(message);

  const handleSelectAnalysis = (
    id: string,
    imageUrl: string,
    species?: string,
  ) => setReferencedAnalysis({ id, imageUrl, species, type: "single" });

  const handleSelectGroup = (id: string, groupName: string) =>
    setReferencedAnalysis({
      id,
      imageUrl: "",
      species: groupName,
      type: "group",
    });

  const handleWeightResult = (
    weightG: number,
    fullResult?: OnlineWeightResult,
  ) => {
    setWeightModalVisible(false);

    if (isScanChat) {
      // Store weight for the specific fish
      setFishWeights((prev) => {
        const next = new Map(prev);
        next.set(weightFishIndex, weightG);
        return next;
      });
      // Update the fish list to reflect the measurement
      setScanFishList((prev) =>
        prev.map((f) =>
          f.index === weightFishIndex ? { ...f, measuredWeightG: weightG } : f,
        ),
      );

      // Persist weight to analysis store for offline detail page
      try {
        const { updateOfflineWeight } = require("../../lib/analysis-store");
        updateOfflineWeight(weightFishIndex, weightG);
      } catch {}

      const species =
        scanFishList.find((f) => f.index === weightFishIndex)?.species ||
        weightSpecies;

      if (fullResult) {
        // Online mode: results are already shown in the modal.
        // Save to backend DB immediately (groupId is available from analysis store).
        const analysisData = getAnalysisData();
        const groupId = analysisData?.mode === "online" ? analysisData.groupId : undefined;
        if (groupId) {
          const { saveWeightEstimate } = require("../../lib/api-client");
          saveWeightEstimate({
            groupId,
            imageUri: analysisData?.mode === "online" ? (analysisData.imageUris?.[0] || "") : "",
            fishIndex: weightFishIndex,
            species,
            weightG,
            timestamp: new Date().toISOString(),
            fullEstimate: fullResult,
          }).catch((e: unknown) => console.warn("[handleWeightResult] Save weight failed:", e));
        }
      } else {
        const kgStr = (weightG / 1000).toFixed(2);
        sendMessage(
          `I measured Fish #${weightFishIndex + 1} (${species}): estimated weight is ${kgStr} kg (${weightG.toFixed(0)}g). What is the current market price for this fish? Any storage or quality recommendations?`,
        );
      }
    } else {
      // ── Standalone weight estimation (from group/fish picker) ──
      const species = weightSpecies;
      const groupId = selectedGroupForWeight?.groupId;
      const source = selectedGroupForWeight?.source;

      if (fullResult) {
        // Online: save weight to backend DB
        if (groupId && source === "online") {
          const { saveWeightEstimate } = require("../../lib/api-client");
          saveWeightEstimate({
            groupId,
            imageUri: "",
            fishIndex: weightFishIndex,
            species,
            weightG,
            timestamp: new Date().toISOString(),
            fullEstimate: fullResult,
          }).catch((e: unknown) => console.warn("[handleWeightResult] Save weight failed:", e));
        }
        // For offline groups, update local history
        if (groupId && source === "offline") {
          import("../../lib/local-history").then(({ updateLocalDetectionWeight }) => {
            updateLocalDetectionWeight(groupId, weightFishIndex, weightG)
              .catch((e) => console.warn("[handleWeightResult] Local weight update failed:", e));
          });
        }
        // Send a confirmation message to chat
        const kgStr = (weightG / 1000).toFixed(2);
        sendMessage(
          `I just weighed Fish #${weightFishIndex + 1} (${species}) - estimated weight: ${kgStr} kg (${weightG.toFixed(0)}g). The weight has been saved to my records. What is the market value for this fish?`,
        );
      } else {
        // Offline inference: save to local history
        if (groupId && source === "offline") {
          import("../../lib/local-history").then(({ updateLocalDetectionWeight }) => {
            updateLocalDetectionWeight(groupId, weightFishIndex, weightG)
              .catch((e) => console.warn("[handleWeightResult] Local weight update failed:", e));
          });
        }
        // For online groups with offline inference, queue the weight estimate
        if (groupId && source === "online") {
          const { saveWeightEstimate } = require("../../lib/api-client");
          saveWeightEstimate({
            groupId,
            imageUri: "",
            fishIndex: weightFishIndex,
            species,
            weightG,
            timestamp: new Date().toISOString(),
          }).catch((e: unknown) => console.warn("[handleWeightResult] Save weight failed:", e));
        }
        const kgStr = (weightG / 1000).toFixed(2);
        sendMessage(
          `I just weighed Fish #${weightFishIndex + 1} (${species}) - estimated weight: ${kgStr} kg (${weightG.toFixed(0)}g). The weight has been saved. What is the current market value? Any quality or storage recommendations?`,
        );
      }
      // Reset selection state
      setSelectedGroupForWeight(null);
    }
  };

  /** Called when user picks a fish from the scan-context FishPickerModal */
  const handleFishSelected = (fishIndex: number, species: string) => {
    setShowFishPicker(false);
    setWeightFishIndex(fishIndex);
    setWeightSpecies(species);
    setWeightModalVisible(true);
  };

  /** Called when user picks a specific fish from the GroupFishPickerModal (standalone tool) */
  const handleGroupFishSelected = (params: {
    groupId: string;
    source: "online" | "offline";
    fishIndex: number;
    species: string;
    cropUrl?: string;
  }) => {
    setShowGroupFishPicker(false);
    setSelectedGroupForWeight({ groupId: params.groupId, source: params.source });
    setWeightFishIndex(params.fishIndex);
    setWeightSpecies(params.species);
    setWeightModalVisible(true);
  };

  const handleCapabilityPress = (cap: AgentCapability) => {
    if (cap.action === "openCamera") router.push("/(tabs)/upload");
    else if (cap.action === "openWeightEstimator") setShowGroupFishPicker(true);
    else if (cap.prompt) sendMessage(cap.prompt);
  };

  const deleteChat = async (chatId: string) => {
    Alert.alert(
      "Delete Conversation",
      "Are you sure you want to delete this conversation?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (effectiveMode === "online") {
                const { deleteConversation } =
                  await import("../../lib/api-client");
                await deleteConversation(chatId);
              }
              const updated = chats.filter((c) => c.id !== chatId);
              setChats(updated);
              await persistConversations(updated);
              if (currentChatId === chatId) createNewChat();
            } catch {
              Alert.alert(
                "Error",
                "Failed to delete conversation. Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  const speakMessage = async (text: string) => {
    if (isSpeaking) {
      sound?.stopAsync();
      sound?.unloadAsync();
      setSound(null);
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
          if (status.isLoaded && status.didJustFinish) {
            setIsSpeaking(false);
            newSound.unloadAsync();
            setSound(null);
          }
        });
      } else {
        setIsSpeaking(false);
      }
    } catch {
      setIsSpeaking(false);
    }
  };

  const exportConversation = async () => {
    if (messages.length === 0) {
      Alert.alert("No Messages", "There are no messages to export.");
      return;
    }
    Alert.alert("Export Conversation", "Choose export format:", [
      { text: "Cancel", style: "cancel" },
      { text: "Text File", onPress: exportAsText },
      { text: "JSON File", onPress: exportAsJSON },
    ]);
  };

  const exportAsText = async () => {
    try {
      const title = currentChatId
        ? chats.find((c) => c.id === currentChatId)?.title || "Chat Export"
        : "Chat Export";
      let content = `${title}\nExported: ${new Date().toLocaleString()}\n${"=".repeat(50)}\n\n`;
      messages.forEach((msg) => {
        content += `[${new Date(msg.timestamp).toLocaleString()}] ${msg.role === "user" ? "You" : "Assistant"}:\n${msg.text}\n\n`;
      });
      const uri = `${FileSystem.cacheDirectory}chat-export-${Date.now()}.txt`;
      await FileSystem.writeAsStringAsync(uri, content);
      if (await Sharing.isAvailableAsync())
        await Sharing.shareAsync(uri, {
          mimeType: "text/plain",
          dialogTitle: "Export Conversation",
        });
      setTimeout(
        async () => {
          const info = await FileSystem.getInfoAsync(uri);
          if (info.exists)
            await FileSystem.deleteAsync(uri, { idempotent: true });
        },
        5 * 60 * 1000,
      );
    } catch {
      Alert.alert("Export Failed", "Failed to export conversation as text.");
    }
  };

  const exportAsJSON = async () => {
    try {
      const title = currentChatId
        ? chats.find((c) => c.id === currentChatId)?.title || "Chat Export"
        : "Chat Export";
      const data = {
        title,
        conversationId: currentChatId,
        exportedAt: new Date().toISOString(),
        messageCount: messages.length,
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.text,
          timestamp: m.timestamp.toISOString(),
        })),
      };
      const uri = `${FileSystem.cacheDirectory}chat-export-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(uri, JSON.stringify(data, null, 2));
      if (await Sharing.isAvailableAsync())
        await Sharing.shareAsync(uri, {
          mimeType: "application/json",
          dialogTitle: "Export Conversation",
        });
      setTimeout(
        async () => {
          const info = await FileSystem.getInfoAsync(uri);
          if (info.exists)
            await FileSystem.deleteAsync(uri, { idempotent: true });
        },
        5 * 60 * 1000,
      );
    } catch {
      Alert.alert("Export Failed", "Failed to export conversation as JSON.");
    }
  };

  const openTelegramApp = async () => {
    try {
      await DeepLinkService.openTelegramBot(
        user?.userId,
        userLocation?.latitude,
        userLocation?.longitude,
      );
    } catch {
      Alert.alert("Error", "Failed to open Telegram. Please try again.");
    }
  };

  // ── Core send ─────────────────────────────────────────────────────────────
  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (
      !trimmed ||
      isTyping ||
      isStreaming ||
      isSendingRef.current
    )
      return;
    isSendingRef.current = true;

    Speech.stop();
    setIsSpeaking(false);
    setInputText("");
    Keyboard.dismiss();

    const finalUserText = trimmed;
    // Strip bracket context tags ([page:...], [userLoc:...], etc.) for display.
    // The full text (with tags) is still sent to the API via messagePayload.
    const displayText = stripContextTags(finalUserText);

    const userMsg: UIMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      text: displayText || finalUserText,
      timestamp: new Date(),
      replyTo: replyingTo
        ? { id: replyingTo.id, text: replyingTo.text, role: replyingTo.role }
        : undefined,
      referencedAnalysis: referencedAnalysis || undefined,
    };

    // Only show the user bubble if there is visible text after stripping context tags.
    // Pure-context auto-sends (e.g. from AskAgentFAB with no custom prompt) remain hidden.
    if (displayText) {
      setMessages((prev) => [...prev, userMsg]);
    }
    setReplyingTo(null);
    const analysisIdToSend = referencedAnalysis?.id;
    setReferencedAnalysis(null);

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);

    let targetChatId = currentChatId;
    if (!targetChatId) {
      try {
        const { createConversation } = await import("../../lib/api-client");
        const newConv = await createConversation(
          (displayText || finalUserText).substring(0, 40),
          locale,
        );
        targetChatId = newConv.conversationId;
        setCurrentChatId(targetChatId);
        if (targetChatId) {
          const newChat: StoredConversation = {
            id: targetChatId,
            title: (displayText || finalUserText).substring(0, 40),
            lastMessageTime: new Date().toISOString(),
          };
          const updated = [newChat, ...chats];
          setChats(updated);
          await persistConversations(updated);
        }
      } catch {}
    } else {
      const updated = chats.map((c) =>
        c.id === targetChatId
          ? { ...c, lastMessageTime: new Date().toISOString() }
          : c,
      );
      setChats(updated);
      await persistConversations(updated);
    }

    isSendingRef.current = false;
    abortRef.current = false;

    const botMsgId = `bot_${Date.now()}`;
    setStreamingMessageId(botMsgId);
    setIsStreaming(true);
    setLiveToolCalls([]);
    setLastSuggestions([]);

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

    const messagePayload = trimmed;

    try {
      await chatStreamClient.streamMessage({
        conversationId: targetChatId ?? undefined,
        message: messagePayload || finalUserText,
        language: locale,
        location: userLocation ?? undefined,
        replyToMessageId: replyingTo?.id,
        analysisId: analysisIdToSend,
        onToken: (token: string) => {
          streamedText += token;
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
        onComplete: (ui?: AgentUIActions) => {
          streamSuccess = true;
          setIsStreaming(false);
          setStreamingMessageId(null);
          setLiveToolCalls([]);
          const cleanText = sanitiseAgentText(streamedText);
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
          setLastSuggestions(
            generateSuggestions(collectedToolCalls, cleanText),
          );
        },
        onError: () => {
          setIsStreaming(false);
          setStreamingMessageId(null);
        },
      });
      if (streamSuccess || abortRef.current) return;
    } catch {}

    setIsStreaming(false);
    setStreamingMessageId(null);
    setMessages((prev) => prev.filter((msg) => msg.id !== botMsgId));
    setIsTyping(true);

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
        const updated = [newChat, ...chats];
        setChats(updated);
        await persistConversations(updated);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `bot_${Date.now()}`,
          role: "assistant",
          text: sanitiseAgentText(res.response),
          timestamp: new Date(res.timestamp),
        },
      ]);
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

  // ── Render message ────────────────────────────────────────────────────────
  const renderMessage = ({ item }: { item: UIMessage }) => {
    const isUser = item.role === "user";
    if (!isUser && item.id === streamingMessageId && item.text === "")
      return null;

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
          style={[styles.swipeReplyAction, { opacity, transform: [{ scale }] }]}
        >
          <View style={styles.swipeReplyCircle}>
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
          style={[
            styles.messageRow,
            isUser ? styles.messageRowUser : styles.messageRowBot,
          ]}
        >
          {!isUser && (
            <View style={styles.botAvatar}>
              <Ionicons
                name="hardware-chip-outline"
                size={15}
                color={COLORS.primaryLight}
              />
            </View>
          )}
          <View
            style={[
              styles.messageContent,
              isUser ? styles.messageContentUser : styles.messageContentBot,
            ]}
          >
            {item.replyTo && (
              <View
                style={[styles.replyContext, isUser && styles.replyContextUser]}
              >
                <Text style={styles.replyAuthor}>
                  {item.replyTo.role === "user" ? "You" : "Assistant"}
                </Text>
                <Text style={styles.replyText} numberOfLines={2}>
                  {item.replyTo.text}
                </Text>
              </View>
            )}
            {item.referencedAnalysis && (
              <View style={styles.analysisReference}>
                {item.referencedAnalysis.imageUrl ? (
                  <Image
                    source={{ uri: item.referencedAnalysis.imageUrl }}
                    style={styles.analysisThumb}
                  />
                ) : (
                  <View
                    style={[
                      styles.analysisThumb,
                      styles.analysisThumbPlaceholder,
                    ]}
                  >
                    <Ionicons
                      name="images"
                      size={18}
                      color={COLORS.primaryLight}
                    />
                  </View>
                )}
                <View style={styles.analysisInfo}>
                  <Text style={styles.analysisLabel}>Referenced Analysis</Text>
                  <Text style={styles.analysisSpecies} numberOfLines={1}>
                    {item.referencedAnalysis.species || "Unknown"}
                  </Text>
                </View>
              </View>
            )}
            {isUser ? (
              <Text style={styles.userText}>{item.text}</Text>
            ) : (
              <StreamingText
                text={item.text}
                isStreaming={streamingMessageId === item.id}
                markdownStyles={markdownStyles}
                plainStyle={markdownStyles.body}
              />
            )}
            {!isUser &&
              item.uiActions?.map &&
              item.uiActions.mapLat &&
              item.uiActions.mapLon && (
                <InlineMapWidget
                  latitude={item.uiActions.mapLat}
                  longitude={item.uiActions.mapLon}
                  onSendLocation={(lat, lon) =>
                    sendMessage(
                      `Tell me about the fishing conditions at ${lat.toFixed(4)}N, ${lon.toFixed(4)}E`,
                    )
                  }
                />
              )}
            {!isUser && item.uiActions?.history && (
              <InlineCatchCarousel
                onAskAboutCatch={(groupId, species) =>
                  sendMessage(
                    `Tell me about my ${species} catch (group ${groupId}). How does it compare to market rates?`,
                  )
                }
              />
            )}
            {!isUser && item.uiActions?.upload && <InlineUploadCard />}
            {!isUser && item.scanResult && (
              <ScanResultCard
                fishCount={item.scanResult.fishCount}
                detections={item.scanResult.detections}
                totalValue={item.scanResult.totalValue}
                onAction={(action) => {
                  if (action === "ask")
                    sendMessage(
                      `Tell me more about my latest scan with ${item.scanResult!.fishCount} fish. Any storage or selling recommendations?`,
                    );
                  else if (action === "buyers")
                    sendMessage(`Help me find buyers for this catch`);
                  else if (action === "compare")
                    sendMessage(
                      `Compare selling prices at different ports for this catch`,
                    );
                }}
              />
            )}
            {/* Weight estimation button for scan→chat flow */}
            {!isUser &&
              isScanChat &&
              scanFishList.length > 0 &&
              streamingMessageId !== item.id &&
              item.text.length > 0 &&
              (() => {
                // Show only on the first or latest non-streaming assistant message
                const assistantMsgs = messages.filter(
                  (m) => m.role === "assistant" && m.text.length > 0,
                );
                const lastAssistant = assistantMsgs[assistantMsgs.length - 1];
                if (lastAssistant?.id !== item.id) return null;

                const measuredCount = scanFishList.filter(
                  (f) => f.measuredWeightG !== null,
                ).length;
                const totalFish = scanFishList.length;
                const totalWeightKg =
                  measuredCount > 0
                    ? scanFishList
                        .filter((f) => f.measuredWeightG !== null)
                        .reduce((sum, f) => sum + f.measuredWeightG!, 0) / 1000
                    : 0;

                return (
                  <TouchableOpacity
                    style={styles.weightEstimateCard}
                    onPress={() => setShowFishPicker(true)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.weightEstimateIcon}>
                      <Ionicons name="scale" size={18} color="#fff" />
                    </View>
                    <View style={styles.weightEstimateContent}>
                      <Text style={styles.weightEstimateTitle}>
                        {measuredCount > 0
                          ? `${measuredCount}/${totalFish} Fish Measured - ${totalWeightKg.toFixed(2)} kg`
                          : "Estimate Weight & Price"}
                      </Text>
                      <Text style={styles.weightEstimateSub}>
                        {measuredCount > 0
                          ? "Tap to measure more fish"
                          : `Measure ${totalFish} detected fish for market pricing`}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color="rgba(255,255,255,0.6)"
                    />
                  </TouchableOpacity>
                );
              })()}
            {!isUser &&
              item.toolsCalled &&
              item.toolsCalled.length > 0 &&
              streamingMessageId !== item.id && (
                <ToolsBadge count={item.toolsCalled.length} />
              )}
            <View
              style={[styles.messageFooter, isUser && styles.messageFooterUser]}
            >
              {!isUser && (
                <TouchableOpacity
                  onPress={() => speakMessage(item.text)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.ttsBtn}
                >
                  <Ionicons
                    name={isSpeaking ? "volume-mute" : "volume-high"}
                    size={13}
                    color={COLORS.textSubtle}
                  />
                </TouchableOpacity>
              )}
              <Text
                style={[styles.messageTime, isUser && styles.messageTimeUser]}
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

  // ── Render hub (empty state) ───────────────────────────────────────────────
  const renderHub = () => (
    <View style={styles.capabilityHub}>
      <View style={styles.hubHeader}>
        <View style={styles.hubIconWrap}>
          <Ionicons name="hardware-chip" size={20} color="#fff" />
        </View>
        <View style={styles.hubHeaderText}>
          <Text style={styles.hubGreeting}>
            {greeting}, {user?.name ?? "Captain"}
          </Text>
          <Text style={styles.hubSubtitle}>What can I help you with?</Text>
        </View>
      </View>
      <View style={styles.capGrid}>
        {AGENT_CAPABILITIES.map((cap) => (
          <TouchableOpacity
            key={cap.label}
            style={styles.capCard}
            onPress={() => handleCapabilityPress(cap)}
            activeOpacity={0.7}
            disabled={isTyping || isStreaming}
          >
            <View
              style={[
                styles.capIconWrap,
                { backgroundColor: cap.color + "18" },
              ]}
            >
              <Ionicons name={cap.icon} size={18} color={cap.color} />
            </View>
            <Text style={styles.capLabel} numberOfLines={1}>
              {cap.label}
            </Text>
            <Text style={styles.capDesc} numberOfLines={1}>
              {cap.desc}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        keyboardShouldPersistTaps="always"
      >
        {QUICK_ACTIONS.map((action) => (
          <TouchableOpacity
            key={action}
            style={styles.chip}
            onPress={() => sendMessage(action)}
            activeOpacity={0.7}
            disabled={isTyping || isStreaming}
          >
            <Ionicons name="sparkles" size={13} color={COLORS.primaryLight} />
            <Text style={styles.chipText}>{action}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // ── Main render ───────────────────────────────────────────────────────────
  if (!isLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {effectiveMode === "offline" && (
          <View style={styles.offlineOverlay}>
            <View style={styles.offlineCard}>
              <Ionicons
                name={
                  connectionQuality === "poor"
                    ? "speedometer-outline"
                    : "cloud-offline"
                }
                size={44}
                color={COLORS.warning}
              />
              <Text style={styles.offlineTitle}>
                {connectionQuality === "poor"
                  ? "Slow Connection"
                  : "No Internet Connection"}
              </Text>
              <Text style={styles.offlineText}>
                {connectionQuality === "poor"
                  ? "AI Assistant requires a stable internet connection."
                  : "AI Assistant requires an active internet connection to function."}
              </Text>
            </View>
          </View>
        )}

        {/* Sidebar */}
        <Modal
          visible={showSidebar}
          transparent
          animationType="none"
          onRequestClose={() => setShowSidebar(false)}
        >
          <TouchableOpacity
            style={styles.sidebarOverlay}
            activeOpacity={1}
            onPress={() => setShowSidebar(false)}
          >
            <Animated.View
              style={[
                styles.sidebar,
                { transform: [{ translateX: sidebarAnim }] },
              ]}
              onStartShouldSetResponder={() => true}
            >
              <View style={styles.sidebarHeader}>
                <Text style={styles.sidebarTitle}>Conversations</Text>
                <TouchableOpacity
                  onPress={() => setShowSidebar(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={22} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.newChatBtn}
                onPress={createNewChat}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.newChatText}>New Chat</Text>
              </TouchableOpacity>
              <ScrollView
                style={styles.chatListScroll}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshingChats}
                    onRefresh={handleRefreshChats}
                    tintColor={COLORS.primaryLight}
                    colors={[COLORS.primaryLight]}
                  />
                }
              >
                {chats.length === 0 ? (
                  <View style={styles.emptyChatList}>
                    <Ionicons
                      name="chatbubbles-outline"
                      size={40}
                      color={COLORS.textSubtle}
                    />
                    <Text style={styles.emptyChatTitle}>
                      No Conversations Yet
                    </Text>
                    <Text style={styles.emptyChatText}>
                      Start chatting for fishing advice, market insights, and
                      catch analysis.
                    </Text>
                  </View>
                ) : (
                  chats.map((chat) => (
                    <View
                      key={chat.id}
                      style={[
                        styles.chatListItem,
                        currentChatId === chat.id && styles.chatListItemActive,
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.chatListItemContent}
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
                        <View style={styles.chatListItemText}>
                          <Text
                            style={[
                              styles.chatListText,
                              currentChatId === chat.id &&
                                styles.chatListTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            {chat.title}
                          </Text>
                          <Text style={styles.chatListTime}>
                            {formatTimestamp(chat.lastMessageTime)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteBtn}
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

        <AnalysisPicker
          visible={showAnalysisPicker}
          onClose={() => setShowAnalysisPicker(false)}
          onSelectAnalysis={handleSelectAnalysis}
          onSelectGroup={handleSelectGroup}
        />
        <TelegramIntegrationModal
          visible={showTelegramModal}
          onClose={() => setShowTelegramModal(false)}
          onOpenTelegram={openTelegramApp}
        />
        <WeightEstimateModal
          visible={weightModalVisible}
          onClose={() => setWeightModalVisible(false)}
          onConfirm={handleWeightResult}
          species={weightSpecies}
          fishIndex={weightFishIndex}
          forceOffline={isScanOffline}
        />
        <FishPickerModal
          visible={showFishPicker}
          onClose={() => setShowFishPicker(false)}
          onSelectFish={handleFishSelected}
          fish={scanFishList}
        />
        <GroupFishPickerModal
          visible={showGroupFishPicker}
          onClose={() => setShowGroupFishPicker(false)}
          onSelectFish={handleGroupFishSelected}
        />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setShowSidebar(true)}
            style={styles.headerBtn}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons
              name="menu-outline"
              size={22}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.headerLogo}>
              <Ionicons
                name="hardware-chip-outline"
                size={14}
                color={COLORS.primaryLight}
              />
            </View>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {currentChatId
                ? chats.find((c) => c.id === currentChatId)?.title ||
                  "AI Assistant"
                : "New Chat"}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => setShowTelegramModal(true)}
              style={styles.headerBtn}
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
              style={styles.headerBtn}
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

        {/* Body */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.flex}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
            ListHeaderComponent={isEmptyChat ? renderHub() : null}
            ListFooterComponent={
              <>
                {isStreaming && liveToolCalls.length > 0 && (
                  <View style={{ paddingHorizontal: 56 }}>
                    <ToolTransparency
                      toolsCalled={liveToolCalls}
                      isWorking={isStreaming}
                    />
                  </View>
                )}
                {(isTyping || isStreaming) &&
                  (() => {
                    const streamingMsg = messages.find(
                      (m) => m.id === streamingMessageId,
                    );
                    const showDots = isTyping || !streamingMsg?.text;
                    return (
                      <View style={styles.typingRow}>
                        <View style={styles.botAvatar}>
                          <Ionicons
                            name="hardware-chip-outline"
                            size={15}
                            color={COLORS.primaryLight}
                          />
                        </View>
                        {showDots && (
                          <View style={styles.typingBubble}>
                            <View style={styles.typingDots}>
                              <Animated.View
                                style={[
                                  styles.dot,
                                  { transform: [{ translateY: dot1Anim }] },
                                ]}
                              />
                              <Animated.View
                                style={[
                                  styles.dot,
                                  { transform: [{ translateY: dot2Anim }] },
                                ]}
                              />
                              <Animated.View
                                style={[
                                  styles.dot,
                                  { transform: [{ translateY: dot3Anim }] },
                                ]}
                              />
                            </View>
                            <Text style={styles.typingLabel}>
                              {isStreaming ? "Generating..." : t("chat.typing")}
                            </Text>
                          </View>
                        )}
                        {isStreaming && (
                          <TouchableOpacity
                            style={styles.stopBtn}
                            onPress={() => {
                              abortRef.current = true;
                              chatStreamClient.stopStreaming();
                              setIsStreaming(false);
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
                {!isTyping &&
                  !isStreaming &&
                  lastSuggestions.length > 0 &&
                  messages.length > 1 && (
                    <SuggestionChips
                      suggestions={lastSuggestions}
                      onSelect={(prompt) => sendMessage(prompt)}
                      disabled={isTyping || isStreaming}
                    />
                  )}
              </>
            }
          />

          {/* Input area */}
          <View style={styles.inputArea}>
            {replyingTo && (
              <View style={styles.replyPreview}>
                <View style={styles.replyPreviewBar} />
                <View style={styles.replyPreviewBody}>
                  <Ionicons
                    name="arrow-undo"
                    size={14}
                    color={COLORS.primaryLight}
                  />
                  <View style={styles.replyPreviewTextCol}>
                    <Text style={styles.replyPreviewAuthor}>
                      Replying to{" "}
                      {replyingTo.role === "user" ? "yourself" : "Assistant"}
                    </Text>
                    <Text style={styles.replyPreviewMessage} numberOfLines={1}>
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
            {referencedAnalysis && (
              <View style={styles.analysisPreview}>
                <View style={styles.replyPreviewBar} />
                <View style={styles.analysisPreviewBody}>
                  {referencedAnalysis.imageUrl ? (
                    <Image
                      source={{ uri: referencedAnalysis.imageUrl }}
                      style={styles.analysisPreviewThumb}
                    />
                  ) : (
                    <View
                      style={[
                        styles.analysisPreviewThumb,
                        styles.analysisPreviewThumbPlaceholder,
                      ]}
                    >
                      <Ionicons
                        name="fish"
                        size={14}
                        color={COLORS.primaryLight}
                      />
                    </View>
                  )}
                  <View style={styles.analysisPreviewTextCol}>
                    <Text style={styles.analysisPreviewLabel}>
                      Referencing Analysis
                    </Text>
                    <Text
                      style={styles.analysisPreviewSpecies}
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

            {/* Inline tools popup - vertical list above send button */}
            {showToolsMenu && (
              <View style={styles.toolsPopup}>
                <TouchableOpacity
                  style={styles.toolsPopupItem}
                  onPress={() => {
                    setShowToolsMenu(false);
                    setShowAnalysisPicker(true);
                  }}
                  disabled={isTyping || isStreaming}
                >
                  <Ionicons
                    name="fish-outline"
                    size={18}
                    color={COLORS.primaryLight}
                  />
                  <Text style={styles.toolsPopupLabel}>Reference Analysis</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.toolsPopupItem}
                  onPress={() => {
                    setShowToolsMenu(false);
                    router.push("/(tabs)/upload");
                  }}
                >
                  <Ionicons
                    name="camera-outline"
                    size={18}
                    color={COLORS.secondary}
                  />
                  <Text style={styles.toolsPopupLabel}>Scan Fish</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.toolsPopupItem}
                  onPress={() => {
                    setShowToolsMenu(false);
                    setShowGroupFishPicker(true);
                  }}
                >
                  <Ionicons name="scale-outline" size={18} color="#f59e0b" />
                  <Text style={styles.toolsPopupLabel}>Weight Estimator</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.toolsPopupItem}
                  onPress={() => {
                    setShowToolsMenu(false);
                    sendMessage(
                      userLocation
                        ? `Show me the current fishing conditions and safety status at my location (${userLocation.latitude.toFixed(2)}N, ${userLocation.longitude.toFixed(2)}E).`
                        : "What are the current fishing conditions near me?",
                    );
                  }}
                  disabled={isTyping || isStreaming}
                >
                  <Ionicons
                    name="location-outline"
                    size={18}
                    color={COLORS.accent}
                  />
                  <Text style={styles.toolsPopupLabel}>
                    Location Conditions
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.toolsPopupItem}
                  onPress={() => {
                    setShowToolsMenu(false);
                    sendMessage(
                      "Show me my recent catch analytics and earnings summary.",
                    );
                  }}
                  disabled={isTyping || isStreaming}
                >
                  <Ionicons
                    name="bar-chart-outline"
                    size={18}
                    color="#7c3aed"
                  />
                  <Text style={styles.toolsPopupLabel}>My Analytics</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.inputRow}>
              <TouchableOpacity
                style={styles.attachBtn}
                onPress={() => setShowAnalysisPicker(true)}
                disabled={isTyping || isStreaming}
              >
                <Ionicons
                  name={referencedAnalysis ? "images" : "images-outline"}
                  size={22}
                  color={
                    referencedAnalysis ? COLORS.primaryLight : COLORS.textSubtle
                  }
                />
              </TouchableOpacity>
              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={(t) => {
                  setInputText(t);
                  if (showToolsMenu) setShowToolsMenu(false);
                }}
                placeholder={t("chat.placeholder")}
                placeholderTextColor={COLORS.textSubtle}
                multiline
                maxLength={1000}
                returnKeyType="send"
                onSubmitEditing={() => sendMessage(inputText)}
              />
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  (!inputText.trim() ||
                    isTyping ||
                    isStreaming) &&
                    styles.sendBtnDisabled,
                ]}
                onPress={() => sendMessage(inputText)}
                disabled={
                  !inputText.trim() ||
                  isTyping ||
                  isStreaming
                }
                activeOpacity={0.75}
              >
                <Ionicons name="arrow-up" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toolsToggleBtn,
                  showToolsMenu && styles.toolsToggleBtnActive,
                ]}
                onPress={() => setShowToolsMenu((v) => !v)}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Ionicons
                  name={showToolsMenu ? "close" : "apps"}
                  size={20}
                  color={
                    showToolsMenu ? COLORS.primaryLight : COLORS.textSubtle
                  }
                />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const markdownStyles = StyleSheet.create({
  body: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 22 },
  heading1: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 6,
  },
  heading2: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 4,
  },
  heading3: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 4,
  },
  paragraph: { marginTop: 0, marginBottom: 8 },
  strong: { fontWeight: "700", color: COLORS.textPrimary },
  em: { fontStyle: "italic" as const },
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
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item: { marginVertical: 2 },
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
  thead: { backgroundColor: "rgba(0,0,0,0.2)" },
  th: {
    padding: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontWeight: "700",
  },
  td: { padding: 6, borderWidth: 1, borderColor: COLORS.border },
  hr: { backgroundColor: COLORS.border, height: 1, marginVertical: 12 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgDark },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bgDark,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  headerLogo: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textPrimary,
    maxWidth: SCREEN_WIDTH * 0.45,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 2 },
  messageList: { paddingTop: 8, paddingBottom: 12 },
  messageRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  messageRowBot: { gap: 10 },
  messageRowUser: { justifyContent: "flex-end" },
  botAvatar: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: COLORS.primary + "25",
    borderWidth: 1.5,
    borderColor: COLORS.primaryLight + "40",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    flexShrink: 0,
  },
  messageContent: { maxWidth: SCREEN_WIDTH * 0.78, flexShrink: 1 },
  messageContentBot: { flex: 1 },
  messageContentUser: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    shadowColor: COLORS.primaryLight,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  userText: { color: "#e0ecff", fontSize: 14, lineHeight: 21 },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 8,
  },
  messageFooterUser: { justifyContent: "flex-end" },
  messageTime: { fontSize: 10, color: COLORS.textSubtle },
  messageTimeUser: { color: "rgba(191,219,254,0.55)" },
  ttsBtn: { padding: 2 },
  replyContext: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.primaryLight,
  },
  replyContextUser: { backgroundColor: "rgba(255,255,255,0.12)" },
  replyAuthor: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.primaryLight,
    marginBottom: 1,
  },
  replyText: { fontSize: 11, color: COLORS.textMuted, lineHeight: 15 },
  analysisReference: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.primaryLight,
    gap: 8,
  },
  analysisThumb: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: COLORS.bgDark,
  },
  analysisThumbPlaceholder: { justifyContent: "center", alignItems: "center" },
  analysisInfo: { flex: 1 },
  analysisLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.primaryLight,
    marginBottom: 1,
  },
  analysisSpecies: { fontSize: 11, color: COLORS.textMuted },
  swipeReplyAction: {
    justifyContent: "center",
    alignItems: "center",
    width: 56,
    paddingRight: 8,
  },
  swipeReplyCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typingDots: { flexDirection: "row", alignItems: "center", gap: 4 },
  typingLabel: { color: COLORS.textMuted, fontSize: 12 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primaryLight,
  },
  stopBtn: { padding: 4, marginLeft: 2 },
  capabilityHub: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 20 },
  hubHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 14,
  },
  hubIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primaryLight,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  hubHeaderText: { flex: 1 },
  hubGreeting: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  hubSubtitle: { fontSize: 14, color: COLORS.textSubtle, marginTop: 1 },
  capGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  capCard: {
    width: "48%",
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: "flex-start",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  capIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  capLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
    textAlign: "left",
    lineHeight: 18,
  },
  capDesc: {
    fontSize: 11,
    color: COLORS.textSubtle,
    textAlign: "left",
    lineHeight: 15,
  },
  chipRow: { gap: 10, paddingBottom: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  chipText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: "500" },
  inputArea: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 10 },
  toolsPopup: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
    overflow: "hidden",
    alignSelf: "flex-end",
    minWidth: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toolsPopupItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  toolsPopupLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textPrimary,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: COLORS.bgCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingLeft: 6,
    paddingRight: 5,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  attachBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  textInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    color: COLORS.textPrimary,
    fontSize: 14,
    maxHeight: 100,
    minHeight: 36,
    lineHeight: 20,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: COLORS.bgSurface, opacity: 0.4 },
  toolsToggleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  toolsToggleBtnActive: { backgroundColor: COLORS.primary + "22" },
  replyPreview: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bgCard,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
    gap: 8,
  },
  replyPreviewBar: {
    width: 3,
    height: "100%",
    backgroundColor: COLORS.primaryLight,
    borderRadius: 2,
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
  },
  replyPreviewBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 4,
  },
  replyPreviewTextCol: { flex: 1 },
  replyPreviewAuthor: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.primaryLight,
    marginBottom: 1,
  },
  replyPreviewMessage: { fontSize: 11, color: COLORS.textMuted },
  analysisPreview: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bgCard,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
    gap: 8,
  },
  analysisPreviewBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 4,
  },
  analysisPreviewThumb: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: COLORS.bgSurface,
  },
  analysisPreviewThumbPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  analysisPreviewTextCol: { flex: 1 },
  analysisPreviewLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.primaryLight,
    marginBottom: 1,
  },
  analysisPreviewSpecies: { fontSize: 11, color: COLORS.textMuted },
  sidebarOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sidebar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH * 0.78,
    backgroundColor: COLORS.bgDark,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: COLORS.border,
    paddingTop: 54,
  },
  sidebarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  sidebarTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },
  newChatBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 10,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  newChatText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  chatListScroll: { flex: 1, paddingHorizontal: 10, paddingTop: 6 },
  chatListItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 2,
  },
  chatListItemActive: {
    backgroundColor: COLORS.primary + "18",
    borderWidth: 1,
    borderColor: COLORS.primary + "40",
  },
  chatListItemContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  chatListItemText: { flex: 1 },
  chatListText: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },
  chatListTextActive: { color: COLORS.primaryLight, fontWeight: "600" },
  chatListTime: { color: COLORS.textSubtle, fontSize: 10, marginTop: 2 },
  deleteBtn: { padding: 6 },
  emptyChatList: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyChatTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginTop: 12,
    marginBottom: 4,
    textAlign: "center",
  },
  emptyChatText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
  offlineOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15,23,42,0.95)",
    zIndex: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  offlineCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    width: SCREEN_WIDTH * 0.8,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  offlineTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  offlineText: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  weightEstimateCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f59e0b" + "15",
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#f59e0b" + "30",
    gap: 10,
  },
  weightEstimateIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f59e0b",
    alignItems: "center",
    justifyContent: "center",
  },
  weightEstimateContent: {
    flex: 1,
  },
  weightEstimateTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  weightEstimateSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
});
