/**
 * DisasterAlerts Component
 *
 * Displays disaster alerts on the map with:
 * - Circle overlays for affected areas
 * - Color-coded by severity (low: green, medium: yellow, high: orange, critical: red)
 * - Alert detail modal on marker press
 * - User safety status calculation
 * - Safety status indicator
 *
 * Requirements: 3.2, 3.3
 */

import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
} from "react-native";
import { Circle as MapCircle, Marker } from "react-native-maps";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Colors } from "../../lib/colors";
import type { DisasterAlert } from "../../lib/alerts";
import {
  getSeverityColor,
  getAlertIcon,
  computeSafetyStatus,
} from "../../lib/alerts";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface DisasterAlertsProps {
  alerts: DisasterAlert[];
  userLocation: { latitude: number; longitude: number } | null;
  onAlertPress?: (alert: DisasterAlert) => void;
}

/**
 * DisasterAlerts Component
 *
 * Renders disaster alerts on the map with circle overlays and markers.
 * Provides alert detail modal and safety status calculation.
 */
export function DisasterAlerts({
  alerts,
  userLocation,
  onAlertPress,
}: DisasterAlertsProps) {
  const [selectedAlert, setSelectedAlert] = useState<DisasterAlert | null>(
    null,
  );

  // Calculate user safety status based on location and alerts
  const safetyStatus = useMemo(() => {
    if (!userLocation) return null;
    return computeSafetyStatus(
      userLocation.latitude,
      userLocation.longitude,
      alerts,
    );
  }, [userLocation, alerts]);

  // Filter out expired alerts
  const activeAlerts = useMemo(() => {
    const now = Date.now();
    return alerts.filter((alert) => new Date(alert.expiresAt).getTime() > now);
  }, [alerts]);

  const handleAlertPress = (alert: DisasterAlert) => {
    setSelectedAlert(alert);
    onAlertPress?.(alert);
  };

  const handleCloseModal = () => {
    setSelectedAlert(null);
  };

  // Get severity display info
  const getSeverityInfo = (severity: string) => {
    switch (severity) {
      case "red":
        return { label: "Critical", color: Colors.alert.critical };
      case "orange":
        return { label: "High", color: Colors.alert.high };
      case "yellow":
        return { label: "Medium", color: Colors.alert.medium };
      default:
        return { label: "Low", color: Colors.alert.low };
    }
  };

  return (
    <>
      {/* Render circle overlays for affected areas */}
      {activeAlerts.map((alert) => (
        <MapCircle
          key={`circle-${alert.id}`}
          center={{ latitude: alert.lat, longitude: alert.lng }}
          radius={alert.radiusKm * 1000} // Convert km to meters
          strokeColor={getSeverityColor(alert.severity) + "80"} // 50% opacity
          fillColor={getSeverityColor(alert.severity) + "15"} // 8% opacity
          strokeWidth={2}
          zIndex={2}
        />
      ))}

      {/* Render markers for alert centers */}
      {activeAlerts.map((alert) => (
        <Marker
          key={`marker-${alert.id}`}
          coordinate={{ latitude: alert.lat, longitude: alert.lng }}
          onPress={() => handleAlertPress(alert)}
          tracksViewChanges={false}
        >
          <View
            className="h-[34px] w-[34px] items-center justify-center rounded-full border-2 border-white shadow-md shadow-black/30"
            style={{ backgroundColor: getSeverityColor(alert.severity) }}
          >
            <Ionicons
              name={getAlertIcon(alert.type) as any}
              size={20}
              color="#fff"
            />
          </View>
        </Marker>
      ))}

      {/* Alert Detail Modal */}
      <Modal
        visible={selectedAlert !== null}
        transparent
        animationType="slide"
        onRequestClose={handleCloseModal}
      >
        <View className="flex-1 justify-end">
          <TouchableOpacity
            className="absolute bottom-0 left-0 right-0 top-0 bg-black/50"
            activeOpacity={1}
            onPress={handleCloseModal}
          />
          <View className="max-h-[85%] rounded-t-[20px] bg-white shadow-lg shadow-black/10">
            {selectedAlert && (
              <>
                {/* Modal Header */}
                <View className="border-b border-gray-200 px-4 pb-3 pt-1.5">
                  <View className="mb-3 h-[3px] w-8 self-center rounded-sm bg-gray-300" />
                  <View className="flex-row items-start gap-3">
                    <View
                      className="h-11 w-11 items-center justify-center rounded-full"
                      style={{
                        backgroundColor:
                          getSeverityColor(selectedAlert.severity) + "20",
                      }}
                    >
                      <Ionicons
                        name={getAlertIcon(selectedAlert.type) as any}
                        size={24}
                        color={getSeverityColor(selectedAlert.severity)}
                      />
                    </View>
                    <View className="flex-1 gap-1">
                      <Text className="text-[15px] font-bold leading-5 text-gray-900">
                        {selectedAlert.title}
                      </Text>
                      <View
                        className="self-start rounded-[10px] px-2 py-[3px]"
                        style={{
                          backgroundColor:
                            getSeverityColor(selectedAlert.severity) + "20",
                        }}
                      >
                        <Text
                          className="text-[11px] font-semibold"
                          style={{ color: getSeverityColor(selectedAlert.severity) }}
                        >
                          {getSeverityInfo(selectedAlert.severity).label}{" "}
                          Severity
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={handleCloseModal}
                      className="p-1"
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons
                        name="close"
                        size={24}
                        color={Colors.neutral[500]}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Modal Body */}
                <ScrollView
                  className="px-4 pt-3.5"
                  showsVerticalScrollIndicator={false}
                >
                  {/* Description */}
                  <View className="mb-4">
                    <Text className="mb-2 text-[12px] font-semibold uppercase tracking-[0.5px] text-gray-700">Description</Text>
                    <Text className="text-[13px] leading-5 text-gray-700">
                      {selectedAlert.description}
                    </Text>
                  </View>

                  {/* Alert Details */}
                  <View className="mb-4">
                    <Text className="mb-2 text-[12px] font-semibold uppercase tracking-[0.5px] text-gray-700">Alert Details</Text>
                    <View className="gap-3">
                      <View className="flex-row items-start gap-2">
                        <Ionicons
                          name="location-outline"
                          size={16}
                          color={Colors.neutral[500]}
                        />
                        <View className="flex-1 gap-0.5">
                          <Text className="text-[12px] text-gray-500">Location</Text>
                          <Text className="text-[13px] font-semibold text-gray-900">
                            {selectedAlert.lat.toFixed(3)}°N,{" "}
                            {selectedAlert.lng.toFixed(3)}°E
                          </Text>
                        </View>
                      </View>

                      <View className="flex-row items-start gap-2">
                        <Ionicons
                          name="resize-outline"
                          size={16}
                          color={Colors.neutral[500]}
                        />
                        <View className="flex-1 gap-0.5">
                          <Text className="text-[12px] text-gray-500">
                            Affected Radius
                          </Text>
                          <Text className="text-[13px] font-semibold text-gray-900">
                            {selectedAlert.radiusKm} km
                          </Text>
                        </View>
                      </View>

                      <View className="flex-row items-start gap-2">
                        <Ionicons
                          name="time-outline"
                          size={16}
                          color={Colors.neutral[500]}
                        />
                        <View className="flex-1 gap-0.5">
                          <Text className="text-[12px] text-gray-500">Expires</Text>
                          <Text className="text-[13px] font-semibold text-gray-900">
                            {new Date(selectedAlert.expiresAt).toLocaleString(
                              "en-IN",
                              {
                                dateStyle: "medium",
                                timeStyle: "short",
                              },
                            )}
                          </Text>
                        </View>
                      </View>

                      <View className="flex-row items-start gap-2">
                        <Ionicons
                          name="information-circle-outline"
                          size={16}
                          color={Colors.neutral[500]}
                        />
                        <View className="flex-1 gap-0.5">
                          <Text className="text-[12px] text-gray-500">Source</Text>
                          <Text className="text-[13px] font-semibold text-gray-900">
                            {selectedAlert.source}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Safety Status */}
                  {userLocation && (
                    <View className="mb-4">
                      <Text className="mb-2 text-[12px] font-semibold uppercase tracking-[0.5px] text-gray-700">
                        Your Safety Status
                      </Text>
                      <View
                        className="flex-row items-center gap-3 rounded-[10px] border-2 p-3"
                        style={{
                          backgroundColor:
                            safetyStatus === "UNSAFE"
                              ? Colors.alert.critical + "10"
                              : Colors.semantic.success + "10",
                          borderColor:
                            safetyStatus === "UNSAFE"
                              ? Colors.alert.critical
                              : Colors.semantic.success,
                        }}
                      >
                        <Ionicons
                          name={
                            safetyStatus === "UNSAFE"
                              ? "warning"
                              : "shield-checkmark"
                          }
                          size={32}
                          color={
                            safetyStatus === "UNSAFE"
                              ? Colors.alert.critical
                              : Colors.semantic.success
                          }
                        />
                        <View className="flex-1 gap-1">
                          <Text
                            className="text-[15px] font-bold"
                            style={{
                              color:
                                safetyStatus === "UNSAFE"
                                  ? Colors.alert.critical
                                  : Colors.semantic.success,
                            }}
                          >
                            {safetyStatus}
                          </Text>
                          <Text className="text-[13px] leading-[18px] text-gray-700">
                            {safetyStatus === "UNSAFE"
                              ? "You are within the affected area. Please take necessary precautions."
                              : "You are outside the affected area. Stay informed of updates."}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                </ScrollView>

                {/* Modal Footer */}
                <View className="border-t border-gray-200 p-3.5">
                  <TouchableOpacity
                    className="items-center rounded-[10px] bg-blue-500 py-2.5"
                    onPress={handleCloseModal}
                    activeOpacity={0.8}
                  >
                    <Text className="text-[14px] font-semibold text-white">Dismiss</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}
