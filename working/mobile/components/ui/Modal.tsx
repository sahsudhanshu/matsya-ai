import React, { useEffect } from "react";
import {
  View,
  Text,
  Modal as RNModal,
  TouchableOpacity,
  Dimensions,
  Animated,
  TouchableWithoutFeedback,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../lib/constants";

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "full";
  className?: string;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const SIZE_HEIGHTS = {
  sm: SCREEN_HEIGHT * 0.5,
  md: SCREEN_HEIGHT * 0.7,
  lg: SCREEN_HEIGHT * 0.85,
  full: SCREEN_HEIGHT * 0.95,
};

export function Modal({
  visible,
  onClose,
  title,
  children,
  footer,
  size = "md",
  className = "",
}: ModalProps) {
  const insets = useSafeAreaInsets();
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const maxHeight = SIZE_HEIGHTS[size];

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 bg-black/75 justify-center items-center p-6">
          <TouchableWithoutFeedback>
            <Animated.View
              className={`bg-slate-800 rounded-[24px] overflow-hidden w-full min-h-[200px] ${className}`}
              style={[
                {
                  maxHeight,
                  paddingBottom: insets.bottom || 16,
                  transform: [{ scale: scaleAnim }],
                  opacity: opacityAnim,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: -4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 8,
                },
              ]}
            >
              {/* Header */}
              <View className="pt-2 px-6 pb-2 border-b border-slate-700 items-center bg-slate-800">
                <View className="w-8 h-[3px] bg-slate-600 rounded-full mb-2" />
                <Text className="text-[15px] font-semibold text-slate-100 text-center">{title}</Text>
                <TouchableOpacity
                  onPress={onClose}
                  className="absolute right-4 top-2 w-7 h-7 rounded-full bg-slate-700 justify-center items-center"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Content */}
              <KeyboardAwareScrollView
                className="grow bg-slate-800"
                contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16, flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
                bounces={false}
                enableOnAndroid={true}
              >
                {children}
              </KeyboardAwareScrollView>

              {/* Footer */}
              {footer && <View className="p-6 border-t border-slate-700 bg-slate-800">{footer}</View>}
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  );
}
