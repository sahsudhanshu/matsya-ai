import React, { useEffect, useRef } from "react";
import { Animated, TextStyle } from "react-native";
import Markdown, { MarkdownProps } from "react-native-markdown-display";

interface Props {
  text: string;
  isStreaming: boolean;
  markdownStyles: MarkdownProps["style"];
  plainStyle: TextStyle; // kept for API compatibility
}

/**
 * Renders assistant text with Markdown throughout - both while streaming and
 * after completion. A ▌ cursor is appended during streaming so the user can
 * see tokens are still arriving. The whole bubble fades in on mount.
 */
export function StreamingText({ text, isStreaming, markdownStyles }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fade in once when the message bubble first appears
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, []);

  const displayText = isStreaming ? text + "▌" : text;

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <Markdown style={markdownStyles}>{displayText}</Markdown>
    </Animated.View>
  );
}
