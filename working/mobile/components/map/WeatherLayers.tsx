import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  
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
    <View className="rounded-[16px] border border-[#334155] bg-[#1e293b] p-4">
      {/* Layer Selection */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
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
              className={`flex-row items-center gap-1 rounded-[12px] border px-4 py-2 ${
                isActive
                  ? "border-[#3b82f6] bg-[#0f3460]"
                  : "border-[#334155] bg-[#334155]"
              }`}
              onPress={() => onLayerChange(layer === "none" ? null : layer)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={config.icon}
                size={20}
                color={isActive ? COLORS.primaryLight : COLORS.textMuted}
              />
              <Text
                className={`text-[12px] font-semibold ${
                  isActive ? "text-[#3b82f6]" : "text-[#94a3b8]"
                }`}
              >
                {config.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Active Layer Info & Controls */}
      {activeLayer && (
        <View className="mt-4 border-t border-[#334155] pt-4">
          {loading ? (
            <View className="flex-row items-center gap-2 p-4">
              <ActivityIndicator size="small" color={COLORS.primaryLight} />
              <Text className="text-[12px] text-[#94a3b8]">Loading layer...</Text>
            </View>
          ) : layerData ? (
            <>
              {/* Layer Description */}
              <View className="mb-1 flex-row items-center gap-2">
                <Ionicons
                  name={LAYER_CONFIG[activeLayer].icon}
                  size={18}
                  color={COLORS.primaryLight}
                />
                <Text className="text-[13px] font-bold text-[#f8fafc]">
                  {LAYER_CONFIG[activeLayer].label}
                </Text>
              </View>
              <Text className="mb-4 text-[12px] text-[#94a3b8]">
                {LAYER_CONFIG[activeLayer].description}
              </Text>

              {/* Opacity Control */}
              <View className="mb-4">
                <Text className="mb-2 text-[12px] font-semibold text-[#e2e8f0]">Opacity</Text>
                <View className="flex-row gap-2">
                  {[0.3, 0.5, 0.7, 1.0].map((value) => (
                    <TouchableOpacity
                      key={value}
                      className={`flex-1 items-center rounded-[12px] border py-2 ${
                        opacity === value
                          ? "border-[#3b82f6] bg-[#0f3460]"
                          : "border-[#334155] bg-[#334155]"
                      }`}
                      onPress={() => onOpacityChange(value)}
                    >
                      <Text
                        className={`text-[12px] font-semibold ${
                          opacity === value ? "text-[#3b82f6]" : "text-[#94a3b8]"
                        }`}
                      >
                        {Math.round(value * 100)}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Legend */}
              {layerData.legend && layerData.legend.length > 0 && (
                <View className="mb-4">
                  <Text className="mb-2 text-[12px] font-semibold text-[#e2e8f0]">Legend</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {layerData.legend.map((item, index) => (
                      <View key={index} className="flex-row items-center gap-1 rounded-[12px] bg-[#334155] px-2 py-1">
                        <View
                          className="h-4 w-4 rounded-[8px] border border-[#334155]"
                          style={{ backgroundColor: item.color }}
                        />
                        <Text className="text-[10px] text-[#e2e8f0]">{item.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Timestamp */}
              <Text className="text-center text-[10px] text-[#94a3b8]">
                Updated: {new Date(layerData.timestamp).toLocaleTimeString()}
              </Text>
            </>
          ) : (
            <View className="flex-row items-center gap-2 rounded-[12px] bg-[#ef444415] p-4">
              <Ionicons
                name="alert-circle-outline"
                size={24}
                color={COLORS.error}
              />
              <Text className="text-[12px] text-[#ef4444]">Failed to load layer data</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
