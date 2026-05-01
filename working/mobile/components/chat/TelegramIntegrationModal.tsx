import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { COLORS } from "../../lib/constants";
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
      <View className="flex-1 bg-[rgba(0,0,0,0.7)] justify-center items-center p-lg">
        <View className="bg-bgCard rounded-2xl w-full max-w-[500px] max-h-[90%] border border-borderDark shadow-lg shadow-black/30">
          {/* Header */}
          <View className="flex-row justify-between items-center p-lg border-b border-borderDark">
            <View className="w-[48px] h-[48px] rounded-[24px] bg-[#1e40af20] justify-center items-center">
              <Ionicons
                name="paper-plane"
                size={28}
                color={COLORS.primaryLight}
              />
            </View>
            <TouchableOpacity onPress={onClose} className="p-xs">
              <Ionicons name="close" size={24} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            className="p-lg"
            showsVerticalScrollIndicator={false}
          >
            <Text className="text-[20px] font-bold text-textPrimary mb-sm">Connect to Telegram</Text>
            <Text className="text-[13px] text-textSecondary leading-[24px] mb-lg">
              Get Matsya AI assistance directly in Telegram! Chat with our AI
              assistant, get fishing advice, and receive notifications about
              ocean conditions.
            </Text>

            {/* Features */}
            <View className="mb-lg">
              <Text className="text-[15px] font-semibold text-textPrimary mb-md">What you can do:</Text>

              <View className="flex-row items-start mb-md">
                <View className="w-[40px] h-[40px] rounded-[20px] bg-[#1e40af15] justify-center items-center mr-sm">
                  <Ionicons
                    name="chatbubbles"
                    size={20}
                    color={COLORS.primaryLight}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[13px] font-semibold text-textPrimary mb-[2px]">
                    Chat with AI Assistant
                  </Text>
                  <Text className="text-[12px] text-textMuted leading-[18px]">
                    Get instant fishing advice and market insights
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start mb-md">
                <View className="w-[40px] h-[40px] rounded-[20px] bg-[#1e40af15] justify-center items-center mr-sm">
                  <Ionicons
                    name="notifications"
                    size={20}
                    color={COLORS.primaryLight}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[13px] font-semibold text-textPrimary mb-[2px]">Receive Alerts</Text>
                  <Text className="text-[12px] text-textMuted leading-[18px]">
                    Get notified about weather warnings and ocean conditions
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start mb-md">
                <View className="w-[40px] h-[40px] rounded-[20px] bg-[#1e40af15] justify-center items-center mr-sm">
                  <Ionicons
                    name="images"
                    size={20}
                    color={COLORS.primaryLight}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[13px] font-semibold text-textPrimary mb-[2px]">Analyze Catches</Text>
                  <Text className="text-[12px] text-textMuted leading-[18px]">
                    Send fish photos for instant species and quality analysis
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start mb-md">
                <View className="w-[40px] h-[40px] rounded-[20px] bg-[#1e40af15] justify-center items-center mr-sm">
                  <Ionicons
                    name="location"
                    size={20}
                    color={COLORS.primaryLight}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[13px] font-semibold text-textPrimary mb-[2px]">Location-Based Tips</Text>
                  <Text className="text-[12px] text-textMuted leading-[18px]">
                    Get recommendations based on your current location
                  </Text>
                </View>
              </View>
            </View>

            {/* Instructions */}
            <View className="mb-lg">
              <Text className="text-[15px] font-semibold text-textPrimary mb-md">How to connect:</Text>
              <View className="flex-row items-start mb-md">
                <View className="w-[28px] h-[28px] rounded-[14px] bg-primary justify-center items-center mr-sm">
                  <Text className="text-[12px] font-bold text-white">1</Text>
                </View>
                <Text className="flex-1 text-[13px] text-textSecondary leading-[22px] pt-1">
                  Tap "Open Telegram" below to launch the Telegram app
                </Text>
              </View>
              <View className="flex-row items-start mb-md">
                <View className="w-[28px] h-[28px] rounded-[14px] bg-primary justify-center items-center mr-sm">
                  <Text className="text-[12px] font-bold text-white">2</Text>
                </View>
                <Text className="flex-1 text-[13px] text-textSecondary leading-[22px] pt-1">
                  Tap "Start" in the Telegram chat to begin
                </Text>
              </View>
              <View className="flex-row items-start mb-md">
                <View className="w-[28px] h-[28px] rounded-[14px] bg-primary justify-center items-center mr-sm">
                  <Text className="text-[12px] font-bold text-white">3</Text>
                </View>
                <Text className="flex-1 text-[13px] text-textSecondary leading-[22px] pt-1">
                  Start chatting with Matsya AI Assistant on Telegram!
                </Text>
              </View>
            </View>

            <View className="flex-row items-start bg-[#3b82f615] rounded-md p-md gap-sm mb-lg">
              <Ionicons
                name="information-circle"
                size={16}
                color={COLORS.info}
              />
              <Text className="flex-1 text-[12px] text-textSecondary leading-[18px]">
                You'll need the Telegram app installed to use this feature.
              </Text>
            </View>
          </ScrollView>

          {/* Actions */}
          <View className="p-lg border-t border-borderDark gap-sm">
            <TouchableOpacity
              className="flex-row items-center justify-center bg-primary rounded-xl p-md gap-sm shadow-sm shadow-primary/30"
              onPress={() => {
                onOpenTelegram();
                onClose();
              }}
            >
              <Ionicons name="paper-plane" size={20} color="#fff" />
              <Text className="text-[13px] font-bold text-white">Open Telegram</Text>
            </TouchableOpacity>
            <TouchableOpacity className="items-center p-sm" onPress={onClose}>
              <Text className="text-[13px] text-textMuted">Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
