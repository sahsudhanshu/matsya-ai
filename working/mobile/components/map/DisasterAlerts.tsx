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
  StyleSheet,
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
            style={[
              styles.alertMarker,
              { backgroundColor: getSeverityColor(alert.severity) },
            ]}
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
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={handleCloseModal}
          />
          <View style={styles.modalContent}>
            {selectedAlert && (
              <>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <View style={styles.modalHandle} />
                  <View style={styles.modalTitleRow}>
                    <View
                      style={[
                        styles.severityBadge,
                        {
                          backgroundColor:
                            getSeverityColor(selectedAlert.severity) + "20",
                        },
                      ]}
                    >
                      <Ionicons
                        name={getAlertIcon(selectedAlert.type) as any}
                        size={24}
                        color={getSeverityColor(selectedAlert.severity)}
                      />
                    </View>
                    <View style={styles.modalTitleContent}>
                      <Text style={styles.modalTitle}>
                        {selectedAlert.title}
                      </Text>
                      <View
                        style={[
                          styles.severityLabel,
                          {
                            backgroundColor:
                              getSeverityColor(selectedAlert.severity) + "20",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.severityLabelText,
                            { color: getSeverityColor(selectedAlert.severity) },
                          ]}
                        >
                          {getSeverityInfo(selectedAlert.severity).label}{" "}
                          Severity
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={handleCloseModal}
                      style={styles.closeButton}
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
                  style={styles.modalBody}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Description */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Description</Text>
                    <Text style={styles.description}>
                      {selectedAlert.description}
                    </Text>
                  </View>

                  {/* Alert Details */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Alert Details</Text>
                    <View style={styles.detailsGrid}>
                      <View style={styles.detailItem}>
                        <Ionicons
                          name="location-outline"
                          size={16}
                          color={Colors.neutral[500]}
                        />
                        <View style={styles.detailContent}>
                          <Text style={styles.detailLabel}>Location</Text>
                          <Text style={styles.detailValue}>
                            {selectedAlert.lat.toFixed(3)}°N,{" "}
                            {selectedAlert.lng.toFixed(3)}°E
                          </Text>
                        </View>
                      </View>

                      <View style={styles.detailItem}>
                        <Ionicons
                          name="resize-outline"
                          size={16}
                          color={Colors.neutral[500]}
                        />
                        <View style={styles.detailContent}>
                          <Text style={styles.detailLabel}>
                            Affected Radius
                          </Text>
                          <Text style={styles.detailValue}>
                            {selectedAlert.radiusKm} km
                          </Text>
                        </View>
                      </View>

                      <View style={styles.detailItem}>
                        <Ionicons
                          name="time-outline"
                          size={16}
                          color={Colors.neutral[500]}
                        />
                        <View style={styles.detailContent}>
                          <Text style={styles.detailLabel}>Expires</Text>
                          <Text style={styles.detailValue}>
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

                      <View style={styles.detailItem}>
                        <Ionicons
                          name="information-circle-outline"
                          size={16}
                          color={Colors.neutral[500]}
                        />
                        <View style={styles.detailContent}>
                          <Text style={styles.detailLabel}>Source</Text>
                          <Text style={styles.detailValue}>
                            {selectedAlert.source}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Safety Status */}
                  {userLocation && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>
                        Your Safety Status
                      </Text>
                      <View
                        style={[
                          styles.safetyCard,
                          {
                            backgroundColor:
                              safetyStatus === "UNSAFE"
                                ? Colors.alert.critical + "10"
                                : Colors.semantic.success + "10",
                            borderColor:
                              safetyStatus === "UNSAFE"
                                ? Colors.alert.critical
                                : Colors.semantic.success,
                          },
                        ]}
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
                        <View style={styles.safetyContent}>
                          <Text
                            style={[
                              styles.safetyStatus,
                              {
                                color:
                                  safetyStatus === "UNSAFE"
                                    ? Colors.alert.critical
                                    : Colors.semantic.success,
                              },
                            ]}
                          >
                            {safetyStatus}
                          </Text>
                          <Text style={styles.safetyMessage}>
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
                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={styles.dismissButton}
                    onPress={handleCloseModal}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.dismissButtonText}>Dismiss</Text>
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

const styles = StyleSheet.create({
  alertMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    paddingTop: 6,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
  },
  modalHandle: {
    width: 32,
    height: 3,
    backgroundColor: Colors.neutral[300],
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  severityBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitleContent: {
    flex: 1,
    gap: 4,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.neutral[900],
    lineHeight: 20,
  },
  severityLabel: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  severityLabelText: {
    fontSize: 11,
    fontWeight: "600",
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.neutral[700],
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.neutral[700],
  },
  detailsGrid: {
    gap: 12,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  detailContent: {
    flex: 1,
    gap: 2,
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.neutral[500],
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.neutral[900],
  },
  safetyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 2,
  },
  safetyContent: {
    flex: 1,
    gap: 4,
  },
  safetyStatus: {
    fontSize: 15,
    fontWeight: "700",
  },
  safetyMessage: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.neutral[700],
  },
  modalFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[200],
  },
  dismissButton: {
    backgroundColor: Colors.primary[500],
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  dismissButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
