/**
 * BoundingBoxOverlay
 *
 * Renders an image with bounding-box rectangles drawn over detected regions.
 * Handles the coordinate mapping from normalised model output (0-1) to
 * the actual displayed image area (accounting for resizeMode="contain" offsets).
 */

import React, { useState, useEffect } from "react";
import { View, Image, StyleSheet, Text } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import type { BoundingBox } from "../lib/detection";
import { COLORS, FONTS, SPACING, RADIUS } from "../lib/constants";

interface Props {
  imageUri: string;
  detections: BoundingBox[];
  /** Available width for the container (usually screen width – padding) */
  containerWidth: number;
  /** Fixed height for the container */
  containerHeight: number;
}

export function BoundingBoxOverlay({
  imageUri,
  detections,
  containerWidth,
  containerHeight,
}: Props) {
  const [imageSize, setImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    Image.getSize(
      imageUri,
      (w, h) => setImageSize({ width: w, height: h }),
      () => setImageSize({ width: containerWidth, height: containerHeight }),
    );
  }, [imageUri]);

  // Calculate the contain-mode rendered dimensions & offsets
  let renderedW = containerWidth;
  let renderedH = containerHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (imageSize) {
    const scaleX = containerWidth / imageSize.width;
    const scaleY = containerHeight / imageSize.height;
    const scale = Math.min(scaleX, scaleY);
    renderedW = imageSize.width * scale;
    renderedH = imageSize.height * scale;
    offsetX = (containerWidth - renderedW) / 2;
    offsetY = (containerHeight - renderedH) / 2;
  }

  return (
    <View
      style={[
        styles.container,
        { width: containerWidth, height: containerHeight },
      ]}
    >
      <Image
        source={{ uri: imageUri }}
        style={{ width: containerWidth, height: containerHeight }}
        resizeMode="contain"
      />

      {/* Bounding boxes */}
      {detections.map((box, idx) => {
        const left = offsetX + box.x1 * renderedW;
        const top = offsetY + box.y1 * renderedH;
        const width = (box.x2 - box.x1) * renderedW;
        const height = (box.y2 - box.y1) * renderedH;

        return (
          <View key={idx} style={[styles.box, { left, top, width, height }]}>
            {/* Small confidence badge in bottom-right corner */}
            <View style={styles.confBadge}>
              <Text style={styles.confText}>
                {(box.confidence * 100).toFixed(0)}%
              </Text>
            </View>
          </View>
        );
      })}

      {/* Detection count badge */}
      <View style={styles.countBadge}>
        <Ionicons name="fish" size={16} color={COLORS.white} />
        <Text style={styles.countText}>{detections.length} detected</Text>
      </View>
    </View>
  );
}

const BOX_COLOR = "#10b981"; // COLORS.success

const styles = StyleSheet.create({
  container: {
    position: "relative",
    borderRadius: RADIUS.xl,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  box: {
    position: "absolute",
    borderWidth: 2.5,
    borderColor: BOX_COLOR,
    borderRadius: 6,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
  },
  confBadge: {
    position: "absolute",
    bottom: -1,
    right: -1,
    backgroundColor: BOX_COLOR,
    borderTopLeftRadius: 6,
    borderBottomRightRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  confText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
  countBadge: {
    position: "absolute",
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  countText: {
    color: "#fff",
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
  },
});
