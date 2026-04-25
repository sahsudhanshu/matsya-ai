/**
 * InlineMapWidget - Satellite map mini card for in-chat location responses.
 * Mirrors the maps tab: PROVIDER_DEFAULT + mapType="none" + UrlTile overlay.
 */
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  PixelRatio,
} from "react-native";
import MapView, {
  Marker,
  UrlTile,
  PROVIDER_DEFAULT,
  Region,
} from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS, RADIUS } from "../../lib/constants";

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
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.mapHeader}>
          <View style={styles.mapHeaderLeft}>
            <Ionicons name="location" size={14} color={COLORS.primaryLight} />
            <Text style={styles.mapHeaderText}>
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
          style={styles.miniMapTapArea}
        >
          {!expanded ? (
            <MapView
              pointerEvents="none"
              style={styles.miniMap}
              provider={PROVIDER_DEFAULT}
              initialRegion={miniRegion}
              mapType="satellite"
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
            <View
              style={[styles.miniMap, { backgroundColor: COLORS.bgCard }]}
            />
          )}
        </TouchableOpacity>

        {/* CTA */}
        {onSendLocation && (
          <TouchableOpacity
            style={styles.sendLocationBtn}
            onPress={() => onSendLocation(latitude, longitude)}
            activeOpacity={0.8}
          >
            <Ionicons name="navigate" size={13} color="#fff" />
            <Text style={styles.sendLocationText}>Ask about this location</Text>
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
        <View style={styles.fullMapContainer}>
          <View style={styles.fullMapHeader}>
            <TouchableOpacity
              onPress={() => {
                setFullMapReady(false);
                setExpanded(false);
              }}
              style={styles.fullMapClose}
            >
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.fullMapTitle}>Location</Text>
            <View style={{ width: 40 }} />
          </View>

          {fullMapReady && (
            <MapView
              style={styles.fullMap}
              provider={PROVIDER_DEFAULT}
              initialRegion={fullRegion}
              mapType="satellite"
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
            <View style={styles.fullMapFooter}>
              <TouchableOpacity
                style={styles.fullSendBtn}
                onPress={() => {
                  onSendLocation(latitude, longitude);
                  setFullMapReady(false);
                  setExpanded(false);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubble" size={16} color="#fff" />
                <Text style={styles.fullSendText}>
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

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.md,
    overflow: "hidden",
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 8,
    marginBottom: 4,
  },
  mapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
  },
  mapHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  mapHeaderText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontFamily: "monospace",
  },
  miniMapTapArea: { height: 160 },
  miniMap: { height: "100%", width: "100%" },
  sendLocationBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    backgroundColor: COLORS.primary + "30",
  },
  sendLocationText: {
    fontSize: 12,
    color: COLORS.primaryLight,
    fontWeight: "600",
  },
  // Full-screen
  fullMapContainer: { flex: 1, backgroundColor: COLORS.bgDark },
  fullMap: { flex: 1 },
  fullMapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: COLORS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  fullMapClose: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  fullMapTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  fullMapFooter: {
    padding: 16,
    paddingBottom: 34,
    backgroundColor: COLORS.bgCard,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  fullSendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
  },
  fullSendText: { fontSize: 15, fontWeight: "600", color: "#fff" },
});
