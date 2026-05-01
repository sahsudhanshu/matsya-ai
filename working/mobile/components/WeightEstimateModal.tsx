/**
 * WeightEstimateModal
 *
 * Prompts the user for the 4 physical measurements (length1, length3, height,
 * width) needed by the on-device XGBoost weight model, then runs inference and
 * displays the predicted weight.
 *
 * Props:
 *   visible      - controls modal visibility
 *   onClose      - called when the user dismisses without a result
 *   onConfirm    - called with the predicted weight (g) when the user taps Done
 *   species      - pre-filled from the TFLite species classifier result
 *   fishIndex    - used for the title ("Fish #N")
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Ionicons } from "@expo/vector-icons";
import { Modal } from "./ui/Modal";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { COLORS } from "../lib/constants";
import {
  estimateFishWeightOnline,
  type OnlineWeightResult,
} from "../lib/api-client";
import { useNetwork } from "../lib/network-context";
import { predictWeight } from "../lib/weight-inference";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (weightG: number, fullResult?: OnlineWeightResult) => void;
  species: string;
  fishIndex: number;
  /** Force offline inference regardless of network state (mirrors the upload screen toggle) */
  forceOffline?: boolean;
}

type Phase = "input" | "loading" | "result" | "error";

// ── Field definitions ──────────────────────────────────────────────────────────

const FIELDS: {
  key: "length1" | "length3" | "height" | "width";
  label: string;
  hint: string;
  placeholder: string;
}[] = [
  {
    key: "length1",
    label: "Vertical Length",
    hint: "Measured along the body from mouth to tail (cm)",
    placeholder: "e.g. 25.0",
  },
  {
    key: "length3",
    label: "Cross Length",
    hint: "Diagonal / cross measurement of the body (cm)",
    placeholder: "e.g. 28.5",
  },
  {
    key: "height",
    label: "Body Height",
    hint: "Tallest point of the body (cm)",
    placeholder: "e.g. 8.0",
  },
  {
    key: "width",
    label: "Body Width",
    hint: "Widest point of the body (cm)",
    placeholder: "e.g. 5.5",
  },
];

// ── Component ──────────────────────────────────────────────────────────────────

export function WeightEstimateModal({
  visible,
  onClose,
  onConfirm,
  species,
  fishIndex,
  forceOffline = false,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>({
    length1: "",
    length3: "",
    height: "",
    width: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>("input");
  const [result, setResult] = useState<OnlineWeightResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const { effectiveMode } = useNetwork();
  const useOffline = forceOffline || effectiveMode === "offline";

  const handleClose = useCallback(() => {
    // Reset state when closing
    setValues({ length1: "", length3: "", height: "", width: "" });
    setErrors({});
    setPhase("input");
    setResult(null);
    setErrorMsg("");
    onClose();
  }, [onClose]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    for (const field of FIELDS) {
      const raw = values[field.key].trim();
      if (!raw) {
        newErrors[field.key] = "This field is required.";
      } else {
        const num = parseFloat(raw);
        if (isNaN(num) || num <= 0) {
          newErrors[field.key] = "Enter a positive number.";
        } else if (num > 200) {
          newErrors[field.key] = "Value seems too large (max 200 cm).";
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    setPhase("loading");

    try {
      if (useOffline) {
        const offlineResult = await predictWeight({
          species,
          length1: parseFloat(values.length1),
          length3: parseFloat(values.length3),
          height: parseFloat(values.height),
          width: parseFloat(values.width),
        });
        const weightG = offlineResult.predictedWeightG;
        onConfirm(weightG, undefined);
        handleClose();
      } else {
        const onlineResult = await estimateFishWeightOnline({
          species,
          length1: parseFloat(values.length1),
          length3: parseFloat(values.length3),
          height: parseFloat(values.height),
          width: parseFloat(values.width),
        });

        // Show the result in the modal before closing
        setResult(onlineResult);
        setPhase("result");
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }, [values, species, onConfirm, handleClose, useOffline]);

  const handleAcceptResult = useCallback(() => {
    if (result) {
      onConfirm(result.estimated_weight_grams, result);
    }
    handleClose();
  }, [result, onConfirm, handleClose]);

  const handleTryAgain = () => {
    setPhase("input");
    setResult(null);
    setErrorMsg("");
  };

  return (
    <Modal
      visible={visible}
      onClose={handleClose}
      title={`Estimate Weight - Fish #${fishIndex + 1}`}
      size="lg"
    >
      <KeyboardAwareScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 24,
          gap: 16,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
      >
        {/* ── Species badge ── */}
        <View className="mb-1 items-center rounded-xl border border-[#3b82f666] bg-[#1e40af33] p-4">
          <Text className="text-[10px] font-semibold uppercase tracking-[0.8px] text-[#94a3b8]">
            Detected Species
          </Text>
          <Text className="mt-0.5 text-[15px] font-bold text-[#3b82f6]">
            {species}
          </Text>
        </View>

        {/* ── Input phase ── */}
        {phase === "input" && (
          <>
            <Text className="text-[12px] leading-5 text-[#94a3b8]">
              Enter the fish measurements below. All values should be in
              centimetres (cm).
            </Text>

            {FIELDS.map((field) => (
              <View key={field.key} className="gap-1">
                <Input
                  label={field.label}
                  placeholder={field.placeholder}
                  value={values[field.key]}
                  onChangeText={(v) => {
                    setValues((prev) => ({ ...prev, [field.key]: v }));
                    if (errors[field.key]) {
                      setErrors((prev) => ({ ...prev, [field.key]: "" }));
                    }
                  }}
                  keyboardType="decimal-pad"
                  error={errors[field.key]}
                />
                <Text className="pl-1 text-[10px] text-[#64748b]">
                  {field.hint}
                </Text>
              </View>
            ))}

            <Button
              label="Estimate Weight"
              onPress={handleSubmit}
              variant="primary"
              className="mt-2"
            />
          </>
        )}

        {/* ── Loading phase ── */}
        {phase === "loading" && (
          <View className="items-center gap-4 py-8">
            <ActivityIndicator
              size="large"
              color={COLORS.primaryLight}
            />
            <Text className="text-[13px] font-semibold text-[#e2e8f0]">
              Estimating weight…
            </Text>
            <Text className="text-[12px] text-[#94a3b8]">
              ML model · Scientific formula · Gemini analysis
            </Text>
          </View>
        )}

        {/* ── Result phase (online) ── */}
        {phase === "result" && result && (
          <View className="gap-4">
            <View className="items-center rounded-xl border border-[#10b98155] bg-[#04785722] p-6">
              <Text className="text-[10px] font-semibold uppercase tracking-[0.8px] text-[#94a3b8]">
                Estimated Weight
              </Text>
              <Text className="mt-1 text-[22px] font-extrabold text-[#10b981]">
                {(result.estimated_weight_grams / 1000).toFixed(2)} kg
              </Text>
              <Text className="mt-0.5 text-[12px] text-[#94a3b8]">
                {result.estimated_weight_grams.toFixed(0)} g
              </Text>
            </View>

            {result.estimated_weight_range && (
              <ResultRow
                label="Weight Range"
                value={`${(result.estimated_weight_range.min_grams / 1000).toFixed(2)}–${(result.estimated_weight_range.max_grams / 1000).toFixed(2)} kg`}
              />
            )}

            {result.market_price_per_kg && (
              <ResultRow
                label="Market Price"
                value={`₹${result.market_price_per_kg.min_inr}–${result.market_price_per_kg.max_inr}/kg`}
              />
            )}

            {result.estimated_fish_value && (
              <ResultRow
                label="Estimated Value"
                value={`₹${result.estimated_fish_value.min_inr}–${result.estimated_fish_value.max_inr}`}
              />
            )}

            {result.quality_grade && (
              <ResultRow label="Quality Grade" value={result.quality_grade} />
            )}

            {result.notes && (
              <ResultRow label="Notes" value={result.notes} muted />
            )}

            <Button
              label="Done"
              onPress={handleAcceptResult}
              variant="primary"
              className="mt-2"
            />
          </View>
        )}

        {/* ── Error phase ── */}
        {phase === "error" && (
          <View className="items-center gap-4 py-8">
            <Ionicons name="warning-outline" size={40} color={COLORS.warning} />
            <Text className="text-[13px] font-semibold text-[#f8fafc]">
              Inference Failed
            </Text>
            <Text className="text-center text-[12px] text-[#94a3b8]">
              {errorMsg}
            </Text>
            <Button
              label="Try Again"
              onPress={handleTryAgain}
              variant="outline"
              className="mt-2"
            />
          </View>
        )}
      </KeyboardAwareScrollView>
    </Modal>
  );
}

// ── Small helper ──────────────────────────────────────────────────────────────

function ResultRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between rounded-xl bg-[#334155] px-4 py-3">
      <Text className="text-[12px] text-[#94a3b8]">{label}</Text>
      <Text
        className={
          muted
            ? "max-w-[65%] text-right text-[12px] italic text-[#64748b]"
            : "max-w-[65%] text-right text-[12px] font-medium text-[#e2e8f0]"
        }
      >
        {value}
      </Text>
    </View>
  );
}
