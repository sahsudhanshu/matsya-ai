/**
 * Image Slider Component - Like a photo gallery for viewing analysis results
 * Allows swiping or button navigation through multiple images
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, SPACING } from '../lib/constants';

const SCREEN_WIDTH = Dimensions.get('window').width;

export interface ImageSliderProps {
  images: Array<{
    uri: string;
    label?: string;
    onPress?: () => void;
  }>;
  currentIndex: number;
  onIndexChange: (index: number) => void;
  containerStyle?: any;
  imageHeight?: number;
  showIndicators?: boolean;
  autoLoop?: boolean;
}

export default function ImageSlider({
  images,
  currentIndex,
  onIndexChange,
  containerStyle,
  imageHeight = 300,
  showIndicators = true,
  autoLoop = false,
}: ImageSliderProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [isScrolling, setIsScrolling] = useState(false);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / SCREEN_WIDTH);
    if (currentIndex !== images.length - 1 && currentIndex !== currentIndex) {
      onIndexChange(currentIndex);
    }
  };

  const goToSlide = (index: number) => {
    setIsScrolling(true);
    scrollViewRef.current?.scrollTo({
      x: index * SCREEN_WIDTH,
      animated: true,
    });
    onIndexChange(index);
    setTimeout(() => setIsScrolling(false), 300);
  };

  const handlePrevious = () => {
    const newIndex = Math.max(0, currentIndex - 1);
    goToSlide(newIndex);
  };

  const handleNext = () => {
    const newIndex = Math.min(images.length - 1, currentIndex + 1);
    goToSlide(newIndex);
  };

  if (images.length === 0) {
    return (
      <View className="mb-5" style={containerStyle}>
        <View className="items-center justify-center rounded-[16px] bg-[#1e293b]" style={{ height: imageHeight }}>
          <Text className="text-[15px] text-[#94a3b8]">No images available</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="mb-5" style={containerStyle}>
      {/* Slider */}
      <View className="relative overflow-hidden rounded-[16px] bg-[#1e293b]">
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          scrollEventThrottle={16}
          onScroll={handleScroll}
          scrollEnabled={images.length > 1}
          showsHorizontalScrollIndicator={false}
          className="overflow-hidden"
        >
          {images.map((image, index) => (
            <View key={index} className="items-center justify-center" style={{ width: SCREEN_WIDTH }}>
              <TouchableOpacity
                onPress={image.onPress}
                activeOpacity={0.9}
                className="w-full items-center justify-center"
              >
                <Image
                  source={{ uri: image.uri }}
                  className="w-full"
                  style={{ height: imageHeight }}
                  resizeMode="cover"
                />
              </TouchableOpacity>
              {image.label && (
                <Text
                  className="absolute bottom-4 rounded-xl px-4 py-1 text-[12px] font-semibold text-[#f8fafc]"
                  style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
                >
                  {image.label}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>

        {/* Navigation Buttons */}
        {images.length > 1 && (
          <>
            <TouchableOpacity
              className="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full"
              style={{ backgroundColor: currentIndex === 0 ? `${COLORS.textMuted}30` : `${COLORS.primaryLight}80` }}
              onPress={handlePrevious}
              disabled={currentIndex === 0}
            >
              <Ionicons
                name="chevron-back"
                size={28}
                color={currentIndex === 0 ? COLORS.textMuted : COLORS.textPrimary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              className="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full"
              style={{ backgroundColor: currentIndex === images.length - 1 ? `${COLORS.textMuted}30` : `${COLORS.primaryLight}80` }}
              onPress={handleNext}
              disabled={currentIndex === images.length - 1}
            >
              <Ionicons
                name="chevron-forward"
                size={28}
                color={
                  currentIndex === images.length - 1
                    ? COLORS.textMuted
                    : COLORS.textPrimary
                }
              />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Indicators */}
      {showIndicators && images.length > 1 && (
        <View className="mt-4 flex-row items-center justify-center gap-2 px-4">
          {images.map((_, index) => (
            <TouchableOpacity
              key={index}
              className="h-2 w-2 rounded-full border border-[#334155]"
              style={index === currentIndex ? { backgroundColor: COLORS.primaryLight, width: 12 } : { backgroundColor: COLORS.bgCard }}
              onPress={() => goToSlide(index)}
            />
          ))}
          <Text className="ml-4 text-[10px] font-semibold text-[#94a3b8]">
            {currentIndex + 1} / {images.length}
          </Text>
        </View>
      )}
    </View>
  );
}
