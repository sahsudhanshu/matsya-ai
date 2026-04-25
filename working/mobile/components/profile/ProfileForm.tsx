import React, { useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { Button, Input } from "../ui";
import type { UserProfile } from "../../lib/types";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";

interface ProfileFormProps {
  initialValues: UserProfile;
  onSave: (values: Partial<UserProfile>) => Promise<void>;
  onCancel: () => void;
}

const ROLE_OPTIONS = [
  "Fisherman",
  "Boat Owner",
  "Fish Trader",
  "Cooperative Member",
  "Researcher",
] as const;

const PORT_OPTIONS = [
  "Mumbai",
  "Chennai",
  "Kochi",
  "Visakhapatnam",
  "Mangalore",
  "Goa",
  "Kolkata",
  "Other (Enter Manually)",
  "Not Available",
];

const BOAT_TYPE_OPTIONS = [
  "Trawler",
  "Gill Netter",
  "Purse Seiner",
  "Catamaran",
  "Country Craft",
  "Motorized",
  "Non-Motorized",
];

export function ProfileForm({
  initialValues,
  onSave,
  onCancel,
}: ProfileFormProps) {
  const [name, setName] = useState(initialValues.name || "");
  const [phone, setPhone] = useState(initialValues.phone || "");
  const [port, setPort] = useState(initialValues.port || "");
  const [customPort, setCustomPort] = useState(initialValues.customPort || "");
  const [region, setRegion] = useState(initialValues.region || "");
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number] | undefined>(
    initialValues.role,
  );
  const [boatType, setBoatType] = useState(initialValues.boatType);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [showRolePicker, setShowRolePicker] = useState(false);
  const [showPortPicker, setShowPortPicker] = useState(false);
  const [showBoatTypePicker, setShowBoatTypePicker] = useState(false);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Name is required";
    }

    if (phone && !/^\+?[1-9]\d{1,14}$/.test(phone.replace(/[\s\-()]/g, ""))) {
      newErrors.phone = "Invalid phone number format (E.164 format expected)";
    }

    if (port === "Other (Enter Manually)" && !customPort.trim()) {
      newErrors.customPort = "Please enter your port name";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      const updates: Partial<UserProfile> = {
        name: name.trim(),
        phone: phone.trim() || undefined,
        port: port === "Other (Enter Manually)" ? customPort.trim() : port,
        customPort:
          port === "Other (Enter Manually)" ? customPort.trim() : undefined,
        region: region.trim() || undefined,
        role,
        boatType,
      };

      await onSave(updates);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to update profile",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Name *</Text>
            <Input
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              error={errors.name}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <Input
              value={initialValues.email}
              editable={false}
              placeholder="Email"
              style={styles.disabledInput}
            />
            <Text style={styles.helpText}>(cannot be changed)</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Phone</Text>
            <Input
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 9876543210"
              keyboardType="phone-pad"
              error={errors.phone}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fishing Information</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Role</Text>
            <Button
              label={role || "Select role"}
              variant="outline"
              onPress={() => setShowRolePicker(!showRolePicker)}
              style={styles.pickerButton}
            />
            {showRolePicker && (
              <View style={styles.pickerOptions}>
                {ROLE_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    label={option}
                    variant={role === option ? "primary" : "ghost"}
                    onPress={() => {
                      setRole(option);
                      setShowRolePicker(false);
                    }}
                    style={styles.pickerOption}
                  />
                ))}
              </View>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Primary Fishing Port</Text>
            <Button
              label={port || "Select port"}
              variant="outline"
              onPress={() => setShowPortPicker(!showPortPicker)}
              style={styles.pickerButton}
            />
            {showPortPicker && (
              <View style={styles.pickerOptions}>
                {PORT_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    label={option}
                    variant={port === option ? "primary" : "ghost"}
                    onPress={() => {
                      setPort(option);
                      setShowPortPicker(false);
                    }}
                    style={styles.pickerOption}
                  />
                ))}
              </View>
            )}
          </View>

          {port === "Other (Enter Manually)" && (
            <View style={styles.field}>
              <Text style={styles.label}>Custom Port Name *</Text>
              <Input
                value={customPort}
                onChangeText={setCustomPort}
                placeholder="Enter port name"
                error={errors.customPort}
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Region</Text>
            <Input
              value={region}
              onChangeText={setRegion}
              placeholder="Enter your region"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Boat Type</Text>
            <Button
              label={boatType || "Select boat type"}
              variant="outline"
              onPress={() => setShowBoatTypePicker(!showBoatTypePicker)}
              style={styles.pickerButton}
            />
            {showBoatTypePicker && (
              <View style={styles.pickerOptions}>
                {BOAT_TYPE_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    label={option}
                    variant={boatType === option ? "primary" : "ghost"}
                    onPress={() => {
                      setBoatType(option as typeof boatType);
                      setShowBoatTypePicker(false);
                    }}
                    style={styles.pickerOption}
                  />
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            label="Cancel"
            variant="outline"
            onPress={onCancel}
            disabled={loading}
            style={styles.actionButton}
          />
          <Button
            label="Save Changes"
            variant="primary"
            onPress={handleSave}
            loading={loading}
            disabled={loading}
            style={styles.actionButton}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl * 2,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semibold as any,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  field: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.medium as any,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  helpText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  disabledInput: {
    backgroundColor: COLORS.border,
    opacity: 0.6,
  },
  pickerButton: {
    justifyContent: "flex-start",
  },
  pickerOptions: {
    marginTop: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgSurface,
    maxHeight: 250,
    overflow: "hidden",
  },
  pickerOption: {
    borderRadius: 0,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  actions: {
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: SPACING.xl,
    paddingTop: SPACING.lg,
  },
  actionButton: {
    flex: 1,
  },
});
