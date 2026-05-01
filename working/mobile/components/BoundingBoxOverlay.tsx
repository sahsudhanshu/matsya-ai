/**
 * BoundingBoxOverlay
 *
 * Renders an image with bounding-box rectangles drawn over detected regions.
 * Handles the coordinate mapping from normalised model output (0-1) to
 * the actual displayed image area (accounting for resizeMode="contain" offsets).
 */

import React, { useState, useEffect } from "react";
import { View, Image, Text } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import type { BoundingBox } from "../lib/detection";
import { COLORS } from "../lib/constants";

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
      className="relative overflow-hidden rounded-[20px] bg-black"
      style={{ width: containerWidth, height: containerHeight }}
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
          <View
            key={idx}
            className="absolute rounded-[6px] border-[2.5px] bg-[rgba(16,185,129,0.08)]"
            style={{ left, top, width, height, borderColor: BOX_COLOR }}
          >
            {/* Small confidence badge in bottom-right corner */}
            <View
              className="absolute bottom-[-1px] right-[-1px] rounded-bl-[6px] rounded-br-[4px] px-[5px] py-[1px]"
              style={{ backgroundColor: BOX_COLOR }}
            >
              <Text className="text-[9px] font-bold text-white">
                {(box.confidence * 100).toFixed(0)}%
              </Text>
            </View>
          </View>
        );
      })}

      {/* Detection count badge */}
      <View
        className="absolute right-2 top-2 flex-row items-center rounded-full px-4 py-1"
        style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      >
        <Ionicons name="fish" size={16} color={COLORS.white} />
        <Text className="text-[10px] font-bold text-white">
          {detections.length} detected
        </Text>
      </View>
    </View>
  );
}

const BOX_COLOR = "#10b981"; // COLORS.success
