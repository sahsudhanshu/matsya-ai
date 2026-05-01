/**
 * InlineMapWidget - Satellite map mini card for in-chat location responses.
 * Mirrors the maps tab: PROVIDER_DEFAULT + mapType="none" + UrlTile overlay.
 */
import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, Modal, PixelRatio } from "react-native";
import MapView, {
  Marker,
  UrlTile,
  PROVIDER_DEFAULT,
  Region,
} from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../lib/constants";

const TILE_SIZE = 256;
const USE_RETINA = PixelRatio.get() >= 2;
const SATELLITE_URL = USE_RETINA
  ? "https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}&scale=2"
  : "https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}";

function regionFor(
  latitude: number,
  longitude: number,
  latitudeDelta: number,
  longitudeDelta: number,
): Region {
  return {
    latitude,
    longitude,
    latitudeDelta,
    longitudeDelta,
  };
}

interface Props {
  latitude: number;
  longitude: number;
  onSendLocation?: (lat: number, lon: number) => void;
}

export function InlineMapWidget({
  latitude,
  longitude,
  onSendLocation,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [fullMapReady, setFullMapReady] = useState(false);
  const miniRegion = useMemo(
    () => regionFor(latitude, longitude, 0.05, 0.05),
    [latitude, longitude],
  );
  const fullRegion = useMemo(
    () => regionFor(latitude, longitude, 0.14, 0.14),
    [latitude, longitude],
  );

  return (
    <>
      <View className="rounded-md overflow-hidden bg-bgCard border border-borderDark mt-2 mb-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-[10px] py-[6px] bg-[rgba(15,23,42,0.6)]">
          <View className="flex-row items-center gap-[6px]">
            <Ionicons name="location" size={14} color={COLORS.primaryLight} />
            <Text className="text-[11px] text-textMuted font-mono">
              {latitude.toFixed(4)}°N, {longitude.toFixed(4)}°E
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setExpanded(true)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons
              name="expand-outline"
              size={16}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>
        </View>

        {/* Mini map */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setExpanded(true)}
          className="h-[160px]"
        >
          {!expanded ? (
            <MapView
              pointerEvents="none"
              style={{ flex: 1, width: "100%", height: "100%" }}
              provider={PROVIDER_DEFAULT}
              initialRegion={miniRegion}
              mapType="hybrid"
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              toolbarEnabled={false}
              loadingEnabled={false}
            >
              <Marker
                coordinate={{ latitude, longitude }}
                pinColor={COLORS.primary}
              />
            </MapView>
          ) : (
            <View className="h-full w-full bg-bgCard" />
          )}
        </TouchableOpacity>

        {/* CTA */}
        {onSendLocation && (
          <TouchableOpacity
            className="flex-row items-center justify-center gap-[6px] py-2 bg-[#1e40af30]"
            onPress={() => onSendLocation(latitude, longitude)}
            activeOpacity={0.8}
          >
            <Ionicons name="navigate" size={13} color="#fff" />
            <Text className="text-[12px] font-semibold text-primaryLight">
              Ask about this location
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Full-screen modal */}
      <Modal
        visible={expanded}
        animationType="slide"
        onShow={() => setFullMapReady(true)}
        onRequestClose={() => {
          setFullMapReady(false);
          setExpanded(false);
        }}
      >
        <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
          <View className="flex-row items-center justify-between px-4 pt-[50px] pb-3 bg-bgCard border-b border-borderDark">
            <TouchableOpacity
              onPress={() => {
                setFullMapReady(false);
                setExpanded(false);
              }}
              className="w-[40px] h-[40px] items-center justify-center"
            >
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text className="text-[15px] font-semibold text-textPrimary">
              Location
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {fullMapReady && (
            <MapView
              style={{ flex: 1 }}
              provider={PROVIDER_DEFAULT}
              initialRegion={fullRegion}
              mapType="hybrid"
              showsUserLocation
              showsCompass
              showsMyLocationButton={false}
              scrollEnabled
              zoomEnabled
              zoomTapEnabled
              zoomControlEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              toolbarEnabled={false}
              loadingEnabled={false}
            >
              <Marker
                coordinate={{ latitude, longitude }}
                title="Fishing location"
                description={`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`}
                pinColor={COLORS.primary}
              />
            </MapView>
          )}

          {onSendLocation && (
            <View className="p-4 pb-[34px] bg-bgCard border-t border-borderDark">
              <TouchableOpacity
                className="flex-row items-center justify-center gap-2 bg-primary rounded-md py-[14px]"
                onPress={() => {
                  onSendLocation(latitude, longitude);
                  setFullMapReady(false);
                  setExpanded(false);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubble" size={16} color="#fff" />
                <Text className="text-[15px] font-semibold text-white">
                  Ask Agent About This Spot
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}
