import React, { useEffect } from "react";
import {
  View,
  Text,
  Modal as RNModal,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  TouchableWithoutFeedback,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "full";
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
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.container,
                {
                  maxHeight,
                  paddingBottom: insets.bottom || SPACING.md,
                  transform: [{ scale: scaleAnim }],
                  opacity: opacityAnim,
                },
              ]}
            >
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.handle} />
                <Text style={styles.title}>{title}</Text>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Content */}
              <KeyboardAwareScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                bounces={false}
                enableOnAndroid={true}
              >
                {children}
              </KeyboardAwareScrollView>

              {/* Footer */}
              {footer && <View style={styles.footer}>{footer}</View>}
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.lg,
  },
  container: {
    backgroundColor: "#1e293b",
    borderRadius: RADIUS["2xl"],
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    width: "100%",
    minHeight: 200,
  },
  header: {
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
    alignItems: "center",
    backgroundColor: "#1e293b",
  },
  handle: {
    width: 32,
    height: 3,
    backgroundColor: "#475569",
    borderRadius: RADIUS.full,
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semibold,
    color: "#f1f5f9",
    textAlign: "center",
  },
  closeButton: {
    position: "absolute",
    right: SPACING.md,
    top: SPACING.sm,
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    backgroundColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flexGrow: 1,
    backgroundColor: "#1e293b",
  },
  contentContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    flexGrow: 1,
  },
  footer: {
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: "#334155",
    backgroundColor: "#1e293b",
  },
});
