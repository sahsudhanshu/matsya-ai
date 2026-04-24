import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getImages } from "../../lib/api-client";
import type { AnalyticsResponse, ImageRecord } from "../../lib/api-client";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import { useLanguage } from "../../lib/i18n";
import { ProfileMenu } from "../../components/ui/ProfileMenu";
import { Card, StatCard } from "../../components/ui/Card";
import { AnalyticsService } from "../../lib/analytics-service";
import { useNetwork } from "../../lib/network-context";
import {
  Skeleton,
  SkeletonStatCard,
  SkeletonBarChart,
  SkeletonSpeciesBreakdown,
  SkeletonQualityCards,
  SkeletonCatchItem,
} from "../../components/ui/Skeleton";
import { PDFService } from "../../lib/pdf-service";
import { EmptyState } from "../../components/ui/EmptyState";
import { useAuth } from "../../lib/auth-context";
import { toastService } from "../../lib/toast-service";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type Analytics = AnalyticsResponse;

const GRADE_COLORS: Record<string, string> = {
  Premium: COLORS.success,
  Standard: COLORS.warning,
  Low: COLORS.error,
};

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-IN");
}

export default function AnalyticsScreen() {
  const { t, isLoaded } = useLanguage();
  const { isOnline, effectiveMode } = useNetwork();
  const { user } = useAuth();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  const loadAnalytics = useCallback(
    async (forceRefresh = false) => {
      try {
        setError(null);

        // Get analytics with caching
        const analyticsData = await AnalyticsService.getAnalytics(forceRefresh);

        if (analyticsData) {
          setAnalytics(analyticsData);
          setIsFromCache(!forceRefresh && effectiveMode === "offline");

          // Get cache timestamp
          const timestamp = await AnalyticsService.getCacheTimestamp();
          setLastUpdated(timestamp);
        } else {
          setError("No analytics data available");
        }
      } catch (e: any) {
        console.error("Failed to load analytics:", e);
        setError(e.message || "Failed to load analytics");

        // Try to load from cache as fallback
        const cachedData = await AnalyticsService.getAnalytics(false);
        if (cachedData) {
          setAnalytics(cachedData);
          setIsFromCache(true);
          const timestamp = await AnalyticsService.getCacheTimestamp();
          setLastUpdated(timestamp);
        }
      }
    },
    [effectiveMode],
  );

  const loadImages = useCallback(async () => {
    try {
      const result = await getImages(10);
      setImages(result.items);
    } catch (e) {
      console.error("Failed to load images:", e);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadAnalytics(true), loadImages()]);
    setRefreshing(false);
  }, [loadAnalytics, loadImages]);

  const onRetry = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.all([loadAnalytics(true), loadImages()]);
    setLoading(false);
  }, [loadAnalytics, loadImages]);

  const handleExportPDF = useCallback(async () => {
    if (!analytics) {
      toastService.error("No analytics data available to export");
      return;
    }

    if (!user) {
      toastService.error("User information not available");
      return;
    }

    setExportingPDF(true);

    try {
      // Prepare catch history from images
      const catchHistory = images
        .filter((img) => img.status === "completed" && img.analysisResult)
        .map((img) => ({
          date: new Date(img.createdAt),
          species: img.analysisResult!.species,
          weight:
            (img.analysisResult!.measurements?.weight_g
              ? img.analysisResult!.measurements.weight_g / 1000
              : img.analysisResult!.weightEstimate) || 0,
          quality: img.analysisResult!.qualityGrade || "Standard",
          earnings:
            img.analysisResult!.marketEstimate?.estimated_value ||
            Math.round(
              (img.analysisResult!.marketPriceEstimate || 0) *
                (img.analysisResult!.weightEstimate || 0),
            ),
        }));

      // Calculate date range
      const dates = images.map((img) => new Date(img.createdAt).getTime());
      const minDate =
        dates.length > 0 ? new Date(Math.min(...dates)) : new Date();
      const maxDate =
        dates.length > 0 ? new Date(Math.max(...dates)) : new Date();

      const dateRange = {
        from: minDate.toLocaleDateString("en-IN", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        to: maxDate.toLocaleDateString("en-IN", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
      };

      // Generate PDF
      const pdfUri = await PDFService.generateAnalyticsReport(
        analytics,
        user.name || user.email || "User",
        dateRange,
        catchHistory.length > 0 ? catchHistory : undefined,
      );

      // Share PDF
      await PDFService.shareReport(pdfUri);

      toastService.success("PDF report generated successfully!");
    } catch (error: any) {
      console.error("Failed to export PDF:", error);

      let errorMessage = "Failed to generate PDF report";
      if (error.message?.includes("Sharing is not available")) {
        errorMessage = "Sharing is not available on this device";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toastService.error(errorMessage);
    } finally {
      setExportingPDF(false);
    }
  }, [analytics, images, user]);

  useEffect(() => {
    Promise.all([loadAnalytics(false), loadImages()]).finally(() =>
      setLoading(false),
    );
  }, [loadAnalytics, loadImages]);

  if (loading || !isLoaded) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{t("nav.analytics")}</Text>
            <Text style={styles.subtitle}>{t("home.statEarnings")}</Text>
          </View>

          {/* Loading Skeletons */}
          <View style={styles.statsGrid}>
            <SkeletonStatCard style={styles.statCard} />
            <SkeletonStatCard style={styles.statCard} />
            <SkeletonStatCard style={styles.statCard} />
            <SkeletonStatCard style={styles.statCard} />
          </View>

          <Text style={styles.sectionTitle}>{t("home.statEarnings")}</Text>
          <Card padding={SPACING.md} style={styles.chartCard}>
            <SkeletonBarChart />
          </Card>

          <Text style={styles.sectionTitle}>{t("home.insightSpecies")}</Text>
          <Card padding={SPACING.md} style={styles.chartCard}>
            <SkeletonSpeciesBreakdown />
          </Card>

          <Text style={styles.sectionTitle}>{t("upload.species")}</Text>
          <SkeletonQualityCards />

          <Text style={styles.sectionTitle}>{t("upload.title")}</Text>
          <SkeletonCatchItem />
          <SkeletonCatchItem />
          <SkeletonCatchItem />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const maxEarnings = Math.max(
    ...(analytics?.weeklyTrend.map((d) => d.earnings) ?? [1]),
  );

  // Show error state when analytics data is unavailable
  if (error && !analytics) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        >
          <View style={styles.header}>
            <Text style={styles.title}>{t("nav.analytics")}</Text>
            <Text style={styles.subtitle}>{t("home.statEarnings")}</Text>
          </View>

          <EmptyState
            icon={
              <Ionicons
                name="bar-chart-outline"
                size={64}
                color={COLORS.textMuted}
              />
            }
            title="No Analytics Data"
            description={
              error ||
              "Upload and analyze catches to see your dashboard. Your earnings, catch statistics, and insights will appear here."
            }
            action={
              isOnline
                ? {
                    label: "Upload Catch",
                    onPress: () => router.push("/"),
                  }
                : undefined
            }
          />

          {!isOnline && (
            <View style={styles.offlineBadge}>
              <Ionicons
                name="cloud-offline-outline"
                size={16}
                color={COLORS.warning}
              />
              <Text style={styles.offlineText}>Offline Mode</Text>
            </View>
          )}

          {/* Still show catch history if we have images */}
          {images && images.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>{t("upload.title")}</Text>
              {images.slice(0, 5).map((img) => (
                <Card
                  key={img.imageId}
                  padding={SPACING.md}
                  style={styles.catchItem}
                >
                  <View style={styles.catchRow}>
                    <View style={styles.catchLeft}>
                      <Ionicons
                        name="fish-outline"
                        size={22}
                        color={COLORS.primaryLight}
                      />
                      <View>
                        <Text style={styles.catchSpecies}>
                          {img.status === "failed"
                            ? "Analysis Failed"
                            : (img.analysisResult?.species ?? "Pending")}
                        </Text>
                        <Text style={styles.catchDate}>
                          {new Date(img.createdAt).toLocaleDateString("en-IN")}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.catchRight}>
                      {img.status === "failed" ? (
                        <View
                          style={[
                            styles.catchGrade,
                            { backgroundColor: COLORS.error + "20" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.catchGradeText,
                              { color: COLORS.error },
                            ]}
                          >
                            FAILED
                          </Text>
                        </View>
                      ) : img.analysisResult ? (
                        <>
                          <View
                            style={[
                              styles.catchGrade,
                              {
                                backgroundColor:
                                  GRADE_COLORS[
                                    img.analysisResult.qualityGrade ??
                                      "Standard"
                                  ] + "20",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.catchGradeText,
                                {
                                  color:
                                    GRADE_COLORS[
                                      img.analysisResult.qualityGrade ??
                                        "Standard"
                                    ],
                                },
                              ]}
                            >
                              {img.analysisResult.qualityGrade ?? "-"}
                            </Text>
                          </View>
                        </>
                      ) : (
                        <View
                          style={[
                            styles.catchGrade,
                            { backgroundColor: COLORS.warning + "20" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.catchGradeText,
                              { color: COLORS.warning },
                            ]}
                          >
                            PENDING
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </Card>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t("nav.analytics")}</Text>
            <Text style={styles.subtitle}>{t("home.statEarnings")}</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.exportButton,
              (exportingPDF || !analytics) && styles.exportButtonDisabled,
            ]}
            onPress={handleExportPDF}
            disabled={exportingPDF || !analytics}
          >
            {exportingPDF ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons
                name="download-outline"
                size={20}
                color={COLORS.white}
              />
            )}
            <Text style={styles.exportButtonText}>
              {exportingPDF ? "Generating..." : "Export PDF"}
            </Text>
          </TouchableOpacity>
          <ProfileMenu size={36} />
        </View>

        {/* Offline/Cache indicator */}
        {(isFromCache || !isOnline) && (
          <View style={styles.cacheIndicator}>
            <Ionicons
              name={isOnline ? "time-outline" : "cloud-offline-outline"}
              size={14}
              color={COLORS.textMuted}
            />
            <Text style={styles.cacheText}>
              {isOnline
                ? `Cached data${lastUpdated ? ` • Updated ${formatRelativeTime(lastUpdated)}` : ""}`
                : "Offline Mode • Showing cached data"}
            </Text>
          </View>
        )}

        {/* Stats Overview */}
        <View style={styles.statsGrid}>
          <StatCard
            label={t("home.statEarnings")}
            value={`₹${analytics ? (analytics.totalEarnings / 1000).toFixed(1) + "K" : "-"}`}
            icon={
              <Ionicons
                name="cash-outline"
                size={20}
                color={COLORS.secondary}
              />
            }
            accentColor={COLORS.secondary}
            style={styles.statCard}
          />
          <StatCard
            label={t("home.statCatches")}
            value={`${analytics?.totalCatches ?? "-"}`}
            icon={
              <Ionicons name="fish-outline" size={20} color={COLORS.primary} />
            }
            accentColor={COLORS.primary}
            style={styles.statCard}
          />
          <StatCard
            label={t("map.weight")}
            value={`${analytics ? analytics.avgWeight.toFixed(0) : "-"}g`}
            icon={
              <Ionicons name="scale-outline" size={20} color={COLORS.accent} />
            }
            accentColor={COLORS.accent}
            style={styles.statCard}
          />
          <StatCard
            label={t("home.insightSpecies")}
            value={analytics?.topSpecies?.split(" ")[0] ?? "-"}
            icon={<Ionicons name="trophy-outline" size={20} color="#7c3aed" />}
            accentColor="#7c3aed"
            style={styles.statCard}
          />
        </View>

        {/* Earnings Chart */}
        <Text style={styles.sectionTitle}>{t("home.statEarnings")}</Text>
        <Card padding={SPACING.md} style={styles.chartCard}>
          <View style={styles.barChart}>
            {analytics?.weeklyTrend.map((day) => {
              const barHeight = Math.max((day.earnings / maxEarnings) * 120, 8);
              return (
                <View key={day.date} style={styles.barWrapper}>
                  <Text style={styles.barValue}>
                    ₹{(day.earnings / 1000).toFixed(0)}k
                  </Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.bar,
                        { height: barHeight, backgroundColor: COLORS.primary },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>{day.date}</Text>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Species Breakdown */}
        <Text style={styles.sectionTitle}>{t("home.insightSpecies")}</Text>
        <Card padding={SPACING.md} style={styles.chartCard}>
          {analytics?.speciesBreakdown.map((s, i) => {
            const colors = [
              COLORS.primary,
              COLORS.secondary,
              COLORS.accent,
              "#7c3aed",
            ];
            const color = colors[i % colors.length];
            return (
              <View key={s.name} style={styles.speciesRow}>
                <View style={styles.speciesLeft}>
                  <View
                    style={[styles.speciesDot, { backgroundColor: color }]}
                  />
                  <Text style={styles.speciesName}>{s.name}</Text>
                </View>
                <View style={styles.speciesBarContainer}>
                  <View
                    style={[
                      styles.speciesBar,
                      {
                        width: `${s.percentage}%`,
                        backgroundColor: color + "80",
                      },
                    ]}
                  />
                </View>
                <Text style={styles.speciesPct}>{s.percentage}%</Text>
              </View>
            );
          })}
        </Card>

        {/* Quality Distribution */}
        <Text style={styles.sectionTitle}>{t("upload.species")}</Text>
        <View style={styles.qualityRow}>
          {analytics?.qualityDistribution.map((q) => (
            <Card key={q.grade} padding={SPACING.md} style={styles.qualityCard}>
              <View
                style={[
                  styles.qualityDot,
                  { backgroundColor: GRADE_COLORS[q.grade] },
                ]}
              />
              <Text
                style={[styles.qualityGrade, { color: GRADE_COLORS[q.grade] }]}
              >
                {q.grade}
              </Text>
              <Text style={styles.qualityCount}>{q.count}</Text>
              <Text style={styles.qualityLabel}>{t("home.statCatches")}</Text>
            </Card>
          ))}
        </View>

        {/* Catch History */}
        <Text style={styles.sectionTitle}>{t("upload.title")}</Text>
        {images &&
          images.length > 0 &&
          images.slice(0, 5).map((img) => (
            <Card
              key={img.imageId}
              padding={SPACING.md}
              style={styles.catchItem}
            >
              <View style={styles.catchRow}>
                <View style={styles.catchLeft}>
                  <Ionicons
                    name="fish-outline"
                    size={22}
                    color={COLORS.primaryLight}
                  />
                  <View>
                    <Text style={styles.catchSpecies}>
                      {img.status === "failed"
                        ? "Analysis Failed"
                        : (img.analysisResult?.species ?? "Pending")}
                    </Text>
                    <Text style={styles.catchDate}>
                      {new Date(img.createdAt).toLocaleDateString("en-IN")}
                    </Text>
                  </View>
                </View>
                <View style={styles.catchRight}>
                  {img.status === "failed" ? (
                    <View
                      style={[
                        styles.catchGrade,
                        { backgroundColor: COLORS.error + "20" },
                      ]}
                    >
                      <Text
                        style={[styles.catchGradeText, { color: COLORS.error }]}
                      >
                        FAILED
                      </Text>
                    </View>
                  ) : img.analysisResult ? (
                    <>
                      <View
                        style={[
                          styles.catchGrade,
                          {
                            backgroundColor:
                              GRADE_COLORS[
                                img.analysisResult.qualityGrade ?? "Standard"
                              ] + "20",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.catchGradeText,
                            {
                              color:
                                GRADE_COLORS[
                                  img.analysisResult.qualityGrade ?? "Standard"
                                ],
                            },
                          ]}
                        >
                          {img.analysisResult.qualityGrade ?? "-"}
                        </Text>
                      </View>
                      <Text style={styles.catchWeight}>
                        {(img.analysisResult.measurements?.weight_g
                          ? img.analysisResult.measurements.weight_g / 1000
                          : img.analysisResult.weightEstimate
                        ).toFixed(2)}{" "}
                        kg
                      </Text>
                      <Text style={styles.catchValue}>
                        ₹
                        {img.analysisResult.marketEstimate?.estimated_value ??
                          Math.round(
                            img.analysisResult.marketPriceEstimate *
                              img.analysisResult.weightEstimate,
                          )}
                      </Text>
                    </>
                  ) : (
                    <View
                      style={[
                        styles.catchGrade,
                        { backgroundColor: COLORS.warning + "20" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.catchGradeText,
                          { color: COLORS.warning },
                        ]}
                      >
                        PENDING
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </Card>
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgDark },
  scroll: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: SPACING["3xl"] },

  header: {
    marginBottom: SPACING.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: {
    fontSize: FONTS.sizes.xl,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.bold,
  },
  subtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  exportButtonDisabled: {
    backgroundColor: COLORS.textMuted,
    opacity: 0.6,
  },
  exportButtonText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.white,
    fontWeight: FONTS.weights.semibold,
  },

  cacheIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    backgroundColor: COLORS.bgCard,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.lg,
    alignSelf: "flex-start",
  },
  cacheText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
  },

  errorContainer: {
    alignItems: "center",
    paddingVertical: SPACING["3xl"],
  },
  errorTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  offlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    backgroundColor: COLORS.warning + "20",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.lg,
  },
  offlineText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.warning,
    fontWeight: FONTS.weights.semibold,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  retryButtonText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.white,
    fontWeight: FONTS.weights.semibold,
  },

  sectionTitle: {
    fontSize: FONTS.sizes.base,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.semibold,
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statCard: { width: "47%" },

  chartCard: { marginBottom: SPACING.lg },

  // Bar Chart
  barChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 160,
  },
  barWrapper: { alignItems: "center", flex: 1, gap: SPACING.xs },
  barValue: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    textAlign: "center",
  },
  barTrack: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: SPACING.xs,
  },
  bar: { borderRadius: RADIUS.sm, minWidth: 16 },
  barLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSubtle },

  // Species
  speciesRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  speciesLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    width: 80,
  },
  speciesDot: { width: 8, height: 8, borderRadius: 4 },
  speciesName: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.medium,
  },
  speciesBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  speciesBar: { height: "100%", borderRadius: RADIUS.full },
  speciesPct: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    width: 35,
    textAlign: "right",
  },

  // Quality
  qualityRow: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  qualityCard: { flex: 1, alignItems: "center" },
  qualityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: SPACING.sm,
  },
  qualityGrade: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold },
  qualityCount: {
    fontSize: FONTS.sizes.xl,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.bold,
    marginTop: SPACING.xs,
  },
  qualityLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },

  // Insights
  insightsCard: { marginBottom: SPACING.xl },
  insightRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
  },
  insightBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },

  insightText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },

  // Catch History
  catchItem: { marginBottom: SPACING.md },
  catchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  catchLeft: { flexDirection: "row", alignItems: "center", gap: SPACING.md },

  catchSpecies: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.semibold,
  },
  catchDate: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  catchRight: { alignItems: "flex-end", gap: SPACING.xs },
  catchGrade: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  catchGradeText: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold },
  catchWeight: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.semibold,
  },
  catchValue: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.success,
    fontWeight: FONTS.weights.bold,
  },
});
