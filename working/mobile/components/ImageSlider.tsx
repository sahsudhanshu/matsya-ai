/**
 * Image Slider Component - Like a photo gallery for viewing analysis results
 * Allows swiping or button navigation through multiple images
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, FONTS, SPACING, RADIUS } from '../lib/constants';

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
      <View style={[styles.container, containerStyle]}>
        <View style={[styles.emptySlide, { height: imageHeight }]}>
          <Text style={styles.emptyText}>No images available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Slider */}
      <View style={styles.sliderWrapper}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          scrollEventThrottle={16}
          onScroll={handleScroll}
          scrollEnabled={images.length > 1}
          showsHorizontalScrollIndicator={false}
          style={styles.scrollView}
        >
          {images.map((image, index) => (
            <View key={index} style={[styles.slide, { width: SCREEN_WIDTH }]}>
              <TouchableOpacity
                onPress={image.onPress}
                activeOpacity={0.9}
                style={styles.imageContainer}
              >
                <Image
                  source={{ uri: image.uri }}
                  style={[styles.image, { height: imageHeight }]}
                  resizeMode="cover"
                />
              </TouchableOpacity>
              {image.label && (
                <Text style={styles.imageLabel}>{image.label}</Text>
              )}
            </View>
          ))}
        </ScrollView>

        {/* Navigation Buttons */}
        {images.length > 1 && (
          <>
            <TouchableOpacity
              style={[
                styles.navButton,
                styles.navButtonLeft,
                currentIndex === 0 && styles.navButtonDisabled,
              ]}
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
              style={[
                styles.navButton,
                styles.navButtonRight,
                currentIndex === images.length - 1 && styles.navButtonDisabled,
              ]}
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
        <View style={styles.indicatorContainer}>
          {images.map((_, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.indicator,
                index === currentIndex ? styles.indicatorActive : styles.indicatorInactive,
              ]}
              onPress={() => goToSlide(index)}
            />
          ))}
          <Text style={styles.indicatorText}>
            {currentIndex + 1} / {images.length}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.xl,
  },
  sliderWrapper: {
    position: 'relative',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  scrollView: {
    overflow: 'hidden',
  },
  slide: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
  },
  imageLabel: {
    position: 'absolute',
    bottom: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
  },
  emptySlide: {
    backgroundColor: COLORS.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMuted,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -14,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primaryLight + '80',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  navButtonLeft: {
    left: SPACING.md,
  },
  navButtonRight: {
    right: SPACING.md,
  },
  navButtonDisabled: {
    backgroundColor: COLORS.textMuted + '30',
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  indicatorActive: {
    backgroundColor: COLORS.primaryLight,
    width: 12,
  },
  indicatorInactive: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  indicatorText: {
    marginLeft: SPACING.md,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.semibold,
  },
});
