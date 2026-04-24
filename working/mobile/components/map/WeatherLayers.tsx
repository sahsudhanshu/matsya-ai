import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { UrlTile } from "react-native-maps";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getWeatherLayerTiles } from "../../lib/api-client";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import { toastService } from "../../lib/toast-service";

export type WeatherLayer = "temperature" | "wind" | "pressure" | "clouds";

interface WeatherLayerData {
  tileUrlTemplate: string;
  opacity: number;
  legend: Array<{ value: number; color: string; label: string }>;
  timestamp: string;
}

interface WeatherLayersProps {
  activeLayer: WeatherLayer | null;
  onLayerChange: (layer: WeatherLayer | null) => void;
  opacity?: number;
}

const LAYER_CONFIG: Record<
  WeatherLayer,
  {
    label: string;
    icon: React.ComponentProps<typeof Ionicons>["name"];
    description: string;
  }
> = {
  temperature: {
    label: "Temperature",
    icon: "thermometer-outline",
    description: "Sea surface temperature",
  },
  wind: {
    label: "Wind",
    icon: "flag-outline",
    description: "Wind speed and direction",
  },
  pressure: {
    label: "Pressure",
    icon: "radio-button-off-outline",
    description: "Atmospheric pressure",
  },
  clouds: {
    label: "Clouds",
    icon: "cloudy-outline",
    description: "Cloud coverage",
  },
};

export function WeatherLayers({
  activeLayer,
  onLayerChange,
  opacity = 0.7,
}: WeatherLayersProps) {
  const [layerData, setLayerData] = useState<WeatherLayerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch layer data when active layer changes
  useEffect(() => {
    if (!activeLayer) {
      setLayerData(null);
      setError(null);
      return;
    }

    const fetchLayerData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getWeatherLayerTiles(activeLayer);
        setLayerData(data);
      } catch (err) {
        console.error("Failed to fetch weather layer:", err);
        toastService.error("Failed to load weather data.");
        setError(
          err instanceof Error ? err.message : "Failed to load weather layer",
        );
        setLayerData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchLayerData();
  }, [activeLayer]);

  // Render tile overlay if we have data
  const renderTileOverlay = () => {
    if (!layerData || !activeLayer) return null;

    return (
      <UrlTile
        urlTemplate={layerData.tileUrlTemplate}
        maximumZ={19}
        opacity={opacity}
        zIndex={1}
      />
    );
  };

  return <>{renderTileOverlay()}</>;
}

interface WeatherLayerControlsProps {
  activeLayer: WeatherLayer | null;
  onLayerChange: (layer: WeatherLayer | null) => void;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
}

export function WeatherLayerControls({
  activeLayer,
  onLayerChange,
  opacity,
  onOpacityChange,
}: WeatherLayerControlsProps) {
  const [layerData, setLayerData] = useState<WeatherLayerData | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch layer data when active layer changes
  useEffect(() => {
    if (!activeLayer) {
      setLayerData(null);
      return;
    }

    const fetchLayerData = async () => {
      setLoading(true);
      try {
        const data = await getWeatherLayerTiles(activeLayer);
        setLayerData(data);
      } catch (err) {
        console.error("Failed to fetch weather layer:", err);
        toastService.error("Failed to load weather data.");
        setLayerData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchLayerData();
  }, [activeLayer]);

  const layers: Array<WeatherLayer | "none"> = [
    "none",
    "temperature",
    "wind",
    "pressure",
    "clouds",
  ];

  return (
    <View style={styles.container}>
      {/* Layer Selection */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.layerScroll}
      >
        {layers.map((layer) => {
          const isActive =
            layer === "none" ? !activeLayer : activeLayer === layer;
          const config =
            layer === "none"
              ? {
                  label: "None",
                  icon: "close-outline" as const,
                  description: "No overlay",
                }
              : LAYER_CONFIG[layer];

          return (
            <TouchableOpacity
              key={layer}
              style={[styles.layerButton, isActive && styles.layerButtonActive]}
              onPress={() => onLayerChange(layer === "none" ? null : layer)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={config.icon}
                size={20}
                color={isActive ? COLORS.primaryLight : COLORS.textMuted}
              />
              <Text
                style={[
                  styles.layerButtonText,
                  isActive && styles.layerButtonTextActive,
                ]}
              >
                {config.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Active Layer Info & Controls */}
      {activeLayer && (
        <View style={styles.activeLayerInfo}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.primaryLight} />
              <Text style={styles.loadingText}>Loading layer...</Text>
            </View>
          ) : layerData ? (
            <>
              {/* Layer Description */}
              <View style={styles.layerHeader}>
                <Ionicons
                  name={LAYER_CONFIG[activeLayer].icon}
                  size={18}
                  color={COLORS.primaryLight}
                />
                <Text style={styles.layerTitle}>
                  {LAYER_CONFIG[activeLayer].label}
                </Text>
              </View>
              <Text style={styles.layerDescription}>
                {LAYER_CONFIG[activeLayer].description}
              </Text>

              {/* Opacity Control */}
              <View style={styles.opacityControl}>
                <Text style={styles.opacityLabel}>Opacity</Text>
                <View style={styles.opacityButtons}>
                  {[0.3, 0.5, 0.7, 1.0].map((value) => (
                    <TouchableOpacity
                      key={value}
                      style={[
                        styles.opacityButton,
                        opacity === value && styles.opacityButtonActive,
                      ]}
                      onPress={() => onOpacityChange(value)}
                    >
                      <Text
                        style={[
                          styles.opacityButtonText,
                          opacity === value && styles.opacityButtonTextActive,
                        ]}
                      >
                        {Math.round(value * 100)}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Legend */}
              {layerData.legend && layerData.legend.length > 0 && (
                <View style={styles.legend}>
                  <Text style={styles.legendTitle}>Legend</Text>
                  <View style={styles.legendItems}>
                    {layerData.legend.map((item, index) => (
                      <View key={index} style={styles.legendItem}>
                        <View
                          style={[
                            styles.legendColor,
                            { backgroundColor: item.color },
                          ]}
                        />
                        <Text style={styles.legendLabel}>{item.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Timestamp */}
              <Text style={styles.timestamp}>
                Updated: {new Date(layerData.timestamp).toLocaleTimeString()}
              </Text>
            </>
          ) : (
            <View style={styles.errorContainer}>
              <Ionicons
                name="alert-circle-outline"
                size={24}
                color={COLORS.error}
              />
              <Text style={styles.errorText}>Failed to load layer data</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  layerScroll: {
    gap: SPACING.sm,
  },
  layerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  layerButtonActive: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primaryLight,
  },
  layerButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textMuted,
  },
  layerButtonTextActive: {
    color: COLORS.primaryLight,
  },
  activeLayerInfo: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  loadingText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
  },
  layerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  layerTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  layerDescription: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },
  opacityControl: {
    marginBottom: SPACING.md,
  },
  opacityLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  opacityButtons: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  opacityButton: {
    flex: 1,
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  opacityButtonActive: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primaryLight,
  },
  opacityButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textMuted,
  },
  opacityButtonTextActive: {
    color: COLORS.primaryLight,
  },
  legend: {
    marginBottom: SPACING.md,
  },
  legendTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  legendItems: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  legendLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
  },
  timestamp: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    textAlign: "center",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.error + "15",
    borderRadius: RADIUS.md,
  },
  errorText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.error,
  },
});
