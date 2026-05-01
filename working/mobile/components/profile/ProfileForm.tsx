import React, { useState } from "react";
import { View, Text, Alert } from "react-native";
import { Button, Input } from "../ui";
import type { UserProfile } from "../../lib/types";
import { COLORS } from "../../lib/constants";

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
    <View className="flex-1">
      <View className="p-4 pb-16">
        <View className="mb-6">
          <Text className="mb-3 text-[13px] font-semibold text-[#f8fafc]">
            Personal Information
          </Text>

          <View className="mb-6">
            <Text className="mb-1 text-[12px] font-medium text-[#f8fafc]">
              Name *
            </Text>
            <Input
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              error={errors.name}
            />
          </View>

          <View className="mb-6">
            <Text className="mb-1 text-[12px] font-medium text-[#f8fafc]">
              Email
            </Text>
            <Input
              value={initialValues.email}
              editable={false}
              placeholder="Email"
              className="opacity-60"
              containerStyle={{ backgroundColor: COLORS.border }}
            />
            <Text className="mt-1 text-[10px] text-[#e2e8f0]">
              (cannot be changed)
            </Text>
          </View>

          <View className="mb-6">
            <Text className="mb-1 text-[12px] font-medium text-[#f8fafc]">
              Phone
            </Text>
            <Input
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 9876543210"
              keyboardType="phone-pad"
              error={errors.phone}
            />
          </View>
        </View>

        <View className="mb-6">
          <Text className="mb-3 text-[13px] font-semibold text-[#f8fafc]">
            Fishing Information
          </Text>

          <View className="mb-6">
            <Text className="mb-1 text-[12px] font-medium text-[#f8fafc]">
              Role
            </Text>
            <Button
              label={role || "Select role"}
              variant="outline"
              onPress={() => setShowRolePicker(!showRolePicker)}
              className="justify-start"
            />
            {showRolePicker && (
              <View className="mt-1 max-h-[250px] overflow-hidden rounded-xl border border-[#334155] bg-[#334155]">
                {ROLE_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    label={option}
                    variant={role === option ? "primary" : "ghost"}
                    onPress={() => {
                      setRole(option);
                      setShowRolePicker(false);
                    }}
                    className="rounded-none border-b border-[#334155]"
                  />
                ))}
              </View>
            )}
          </View>

          <View className="mb-6">
            <Text className="mb-1 text-[12px] font-medium text-[#f8fafc]">
              Primary Fishing Port
            </Text>
            <Button
              label={port || "Select port"}
              variant="outline"
              onPress={() => setShowPortPicker(!showPortPicker)}
              className="justify-start"
            />
            {showPortPicker && (
              <View className="mt-1 max-h-[250px] overflow-hidden rounded-xl border border-[#334155] bg-[#334155]">
                {PORT_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    label={option}
                    variant={port === option ? "primary" : "ghost"}
                    onPress={() => {
                      setPort(option);
                      setShowPortPicker(false);
                    }}
                    className="rounded-none border-b border-[#334155]"
                  />
                ))}
              </View>
            )}
          </View>

          {port === "Other (Enter Manually)" && (
            <View className="mb-6">
              <Text className="mb-1 text-[12px] font-medium text-[#f8fafc]">
                Custom Port Name *
              </Text>
              <Input
                value={customPort}
                onChangeText={setCustomPort}
                placeholder="Enter port name"
                error={errors.customPort}
              />
            </View>
          )}

          <View className="mb-6">
            <Text className="mb-1 text-[12px] font-medium text-[#f8fafc]">
              Region
            </Text>
            <Input
              value={region}
              onChangeText={setRegion}
              placeholder="Enter your region"
            />
          </View>

          <View className="mb-6">
            <Text className="mb-1 text-[12px] font-medium text-[#f8fafc]">
              Boat Type
            </Text>
            <Button
              label={boatType || "Select boat type"}
              variant="outline"
              onPress={() => setShowBoatTypePicker(!showBoatTypePicker)}
              className="justify-start"
            />
            {showBoatTypePicker && (
              <View className="mt-1 max-h-[250px] overflow-hidden rounded-xl border border-[#334155] bg-[#334155]">
                {BOAT_TYPE_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    label={option}
                    variant={boatType === option ? "primary" : "ghost"}
                    onPress={() => {
                      setBoatType(option as typeof boatType);
                      setShowBoatTypePicker(false);
                    }}
                    className="rounded-none border-b border-[#334155]"
                  />
                ))}
              </View>
            )}
          </View>
        </View>

        <View className="mt-6 flex-row gap-4 border-t border-[#334155] pt-6">
          <Button
            label="Cancel"
            variant="outline"
            onPress={onCancel}
            disabled={loading}
            className="flex-1"
          />
          <Button
            label="Save Changes"
            variant="primary"
            onPress={handleSave}
            loading={loading}
            disabled={loading}
            className="flex-1"
          />
        </View>
      </View>
    </View>
  );
}
