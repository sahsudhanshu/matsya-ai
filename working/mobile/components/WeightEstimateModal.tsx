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
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Ionicons } from "@expo/vector-icons";
import { Modal } from "./ui/Modal";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { COLORS, FONTS, SPACING, RADIUS } from "../lib/constants";
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
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
      >
        {/* ── Species badge ── */}
        <View style={styles.speciesBadge}>
          <Text style={styles.speciesBadgeLabel}>Detected Species</Text>
          <Text style={styles.speciesBadgeValue}>{species}</Text>
        </View>

        {/* ── Input phase ── */}
        {phase === "input" && (
          <>
            <Text style={styles.instruction}>
              Enter the fish measurements below. All values should be in
              centimetres (cm).
            </Text>

            {FIELDS.map((field) => (
              <View key={field.key} style={styles.fieldBlock}>
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
                <Text style={styles.hint}>{field.hint}</Text>
              </View>
            ))}

            <Button
              label="Estimate Weight"
              onPress={handleSubmit}
              variant="primary"
              style={styles.submitBtn}
            />
          </>
        )}

        {/* ── Loading phase ── */}
        {phase === "loading" && (
          <View style={styles.centeredSection}>
            <ActivityIndicator
              size="large"
              color={COLORS.primaryLight}
              style={styles.spinner}
            />
            <Text style={styles.loadingText}>Estimating weight…</Text>
            <Text style={styles.loadingSubtext}>
              ML model · Scientific formula · Gemini analysis
            </Text>
          </View>
        )}

        {/* ── Result phase (online) ── */}
        {phase === "result" && result && (
          <View style={styles.resultSection}>
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>Estimated Weight</Text>
              <Text style={styles.resultWeight}>
                {(result.estimated_weight_grams / 1000).toFixed(2)} kg
              </Text>
              <Text style={styles.resultWeightKg}>
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
              style={styles.submitBtn}
            />
          </View>
        )}

        {/* ── Error phase ── */}
        {phase === "error" && (
          <View style={styles.centeredSection}>
            <Ionicons name="warning-outline" size={40} color={COLORS.warning} />
            <Text style={styles.errorTitle}>Inference Failed</Text>
            <Text style={styles.errorMsg}>{errorMsg}</Text>
            <Button
              label="Try Again"
              onPress={handleTryAgain}
              variant="outline"
              style={styles.retryBtn}
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
    <View style={styles.resultRow}>
      <Text style={styles.resultRowLabel}>{label}</Text>
      <Text style={[styles.resultRowValue, muted && styles.resultRowMuted]}>
        {value}
      </Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
    gap: SPACING.md,
  },

  speciesBadge: {
    backgroundColor: COLORS.primary + "33",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primaryLight + "66",
    padding: SPACING.md,
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  speciesBadgeLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  speciesBadgeValue: {
    fontSize: FONTS.sizes.md,
    color: COLORS.primaryLight,
    fontWeight: FONTS.weights.bold,
    marginTop: 2,
  },

  instruction: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    lineHeight: 20,
  },

  fieldBlock: {
    gap: 4,
  },
  hint: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSubtle,
    paddingLeft: SPACING.xs,
  },

  submitBtn: {
    marginTop: SPACING.sm,
  },

  // Loading
  centeredSection: {
    alignItems: "center",
    paddingVertical: SPACING.xl,
    gap: SPACING.md,
  },
  spinner: {
    marginBottom: SPACING.sm,
  },
  loadingText: {
    fontSize: FONTS.sizes.base,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.semibold,
  },
  loadingSubtext: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
  },

  // Result
  resultSection: {
    gap: SPACING.md,
  },
  resultCard: {
    backgroundColor: COLORS.secondary + "22",
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.secondaryLight + "55",
    padding: SPACING.lg,
    alignItems: "center",
  },
  resultTitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  resultWeight: {
    fontSize: FONTS.sizes["2xl"],
    color: COLORS.secondaryLight,
    fontWeight: FONTS.weights.extrabold,
    marginTop: SPACING.xs,
  },
  resultWeightKg: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // Method breakdown
  methodBreakdown: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primaryLight + "33",
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  methodBreakdownTitle: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: SPACING.xs,
  },
  methodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  methodRowAvg: {
    marginTop: SPACING.xs,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.primaryLight + "33",
  },
  methodLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
  },
  methodValue: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.medium,
  },
  methodLabelAvg: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primaryLight,
    fontWeight: FONTS.weights.semibold,
  },
  methodValueAvg: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primaryLight,
    fontWeight: FONTS.weights.bold,
  },

  resultMeta: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resultRowLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
  },
  resultRowValue: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.medium,
  },
  resultRowMuted: {
    color: COLORS.textSubtle,
    fontStyle: "italic",
  },

  buttonRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  halfBtn: {
    flex: 1,
  },
  retryBtn: {
    alignSelf: "center",
    minWidth: 140,
  },

  // Error
  errorIcon: {
    fontSize: 40,
  },
  errorTitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.error,
    fontWeight: FONTS.weights.bold,
  },
  errorMsg: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: SPACING.md,
  },
});
