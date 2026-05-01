import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  
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
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24, paddingBottom: 64 }}
        >
          <View className="mb-lg flex-row justify-between items-start">
            <Text className="text-xl text-textPrimary font-bold">{t("nav.analytics")}</Text>
            <Text className="text-sm text-textMuted mt-xs">{t("home.statEarnings")}</Text>
          </View>

          {/* Loading Skeletons */}
          <View className="flex-row flex-wrap gap-sm mb-lg">
            <SkeletonStatCard className="w-[47%]" />
            <SkeletonStatCard className="w-[47%]" />
            <SkeletonStatCard className="w-[47%]" />
            <SkeletonStatCard className="w-[47%]" />
          </View>

          <Text className="text-base text-textPrimary font-semibold mb-sm mt-xs">{t("home.statEarnings")}</Text>
          <Card padding={SPACING.md} className="mb-lg">
            <SkeletonBarChart />
          </Card>

          <Text className="text-base text-textPrimary font-semibold mb-sm mt-xs">{t("home.insightSpecies")}</Text>
          <Card padding={SPACING.md} className="mb-lg">
            <SkeletonSpeciesBreakdown />
          </Card>

          <Text className="text-base text-textPrimary font-semibold mb-sm mt-xs">{t("upload.species")}</Text>
          <SkeletonQualityCards />

          <Text className="text-base text-textPrimary font-semibold mb-sm mt-xs">{t("upload.title")}</Text>
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
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24, paddingBottom: 64 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        >
          <View className="mb-lg flex-row justify-between items-start">
            <Text className="text-xl text-textPrimary font-bold">{t("nav.analytics")}</Text>
            <Text className="text-sm text-textMuted mt-xs">{t("home.statEarnings")}</Text>
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
            <View className="flex-row items-center gap-xs bg-warning/20 px-md py-sm rounded-full mb-lg">
              <Ionicons
                name="cloud-offline-outline"
                size={16}
                color={COLORS.warning}
              />
              <Text className="text-xs text-warning font-semibold">Offline Mode</Text>
            </View>
          )}

          {/* Still show catch history if we have images */}
          {images && images.length > 0 && (
            <>
              <Text className="text-base text-textPrimary font-semibold mb-sm mt-xs">{t("upload.title")}</Text>
              {images.slice(0, 5).map((img) => (
                <Card
                  key={img.imageId}
                  padding={SPACING.md}
                  className="mb-md"
                >
                  <View className="flex-row justify-between items-center">
                    <View className="flex-row items-center gap-md">
                      <Ionicons
                        name="fish-outline"
                        size={22}
                        color={COLORS.primaryLight}
                      />
                      <View>
                        <Text className="text-sm text-textPrimary font-semibold">
                          {img.status === "failed"
                            ? "Analysis Failed"
                            : (img.analysisResult?.species ?? "Pending")}
                        </Text>
                        <Text className="text-xs text-textMuted mt-[2px]">
                          {new Date(img.createdAt).toLocaleDateString("en-IN")}
                        </Text>
                      </View>
                    </View>
                    <View className="items-end gap-xs">
                      {img.status === "failed" ? (
                        <View
                          className="rounded-full px-sm py-[2px] bg-error/20"
                        >
                          <Text
                            className="text-xs font-bold text-error"
                          >
                            FAILED
                          </Text>
                        </View>
                      ) : img.analysisResult ? (
                        <>
                          <View
                            className="rounded-full px-sm py-[2px]" style={{ backgroundColor: GRADE_COLORS[img.analysisResult.qualityGrade ?? "Standard"] + "20" }}
                          >
                            <Text
                              className="text-xs font-bold" style={{ color: GRADE_COLORS[img.analysisResult.qualityGrade ?? "Standard"] }}
                            >
                              {img.analysisResult.qualityGrade ?? "-"}
                            </Text>
                          </View>
                        </>
                      ) : (
                        <View
                          className="rounded-full px-sm py-[2px] bg-warning/20"
                        >
                          <Text
                            className="text-xs font-bold text-warning"
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingBottom: 64 }}
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
        <View className="mb-lg flex-row justify-between items-start">
          <View style={{ flex: 1 }}>
            <Text className="text-xl text-textPrimary font-bold">{t("nav.analytics")}</Text>
            <Text className="text-sm text-textMuted mt-xs">{t("home.statEarnings")}</Text>
          </View>
          <TouchableOpacity
            className={`flex-row items-center gap-xs bg-primary px-sm py-[6px] rounded-md ${exportingPDF || !analytics ? "bg-textMuted opacity-60" : ""}`}
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
            <Text className="text-sm text-white font-semibold">
              {exportingPDF ? "Generating..." : "Export PDF"}
            </Text>
          </TouchableOpacity>
          <ProfileMenu size={36} />
        </View>

        {/* Offline/Cache indicator */}
        {(isFromCache || !isOnline) && (
          <View className="flex-row items-center gap-xs bg-bgCard px-md py-sm rounded-full mb-lg self-start">
            <Ionicons
              name={isOnline ? "time-outline" : "cloud-offline-outline"}
              size={14}
              color={COLORS.textMuted}
            />
            <Text className="text-xs text-textMuted">
              {isOnline
                ? `Cached data${lastUpdated ? ` • Updated ${formatRelativeTime(lastUpdated)}` : ""}`
                : "Offline Mode • Showing cached data"}
            </Text>
          </View>
        )}

        {/* Stats Overview */}
        <View className="flex-row flex-wrap gap-sm mb-lg">
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
            className="w-[47%]"
          />
          <StatCard
            label={t("home.statCatches")}
            value={`${analytics?.totalCatches ?? "-"}`}
            icon={
              <Ionicons name="fish-outline" size={20} color={COLORS.primary} />
            }
            accentColor={COLORS.primary}
            className="w-[47%]"
          />
          <StatCard
            label={t("map.weight")}
            value={`${analytics ? analytics.avgWeight.toFixed(0) : "-"}g`}
            icon={
              <Ionicons name="scale-outline" size={20} color={COLORS.accent} />
            }
            accentColor={COLORS.accent}
            className="w-[47%]"
          />
          <StatCard
            label={t("home.insightSpecies")}
            value={analytics?.topSpecies?.split(" ")[0] ?? "-"}
            icon={<Ionicons name="trophy-outline" size={20} color="#7c3aed" />}
            accentColor="#7c3aed"
            className="w-[47%]"
          />
        </View>

        {/* Earnings Chart */}
        <Text className="text-base text-textPrimary font-semibold mb-sm mt-xs">{t("home.statEarnings")}</Text>
        <Card padding={SPACING.md} className="mb-lg">
          <View className="flex-row items-end justify-between h-[160px]">
            {analytics?.weeklyTrend.map((day) => {
              const barHeight = Math.max((day.earnings / maxEarnings) * 120, 8);
              return (
                <View key={day.date} className="items-center flex-1 gap-xs">
                  <Text className="text-xs text-textMuted text-center">
                    ₹{(day.earnings / 1000).toFixed(0)}k
                  </Text>
                  <View className="flex-1 justify-end px-xs">
                    <View
                      className="rounded-sm min-w-[16px] bg-primary" style={{ height: barHeight }}
                    />
                  </View>
                  <Text className="text-xs text-textSubtle">{day.date}</Text>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Species Breakdown */}
        <Text className="text-base text-textPrimary font-semibold mb-sm mt-xs">{t("home.insightSpecies")}</Text>
        <Card padding={SPACING.md} className="mb-lg">
          {analytics?.speciesBreakdown.map((s, i) => {
            const colors = [
              COLORS.primary,
              COLORS.secondary,
              COLORS.accent,
              "#7c3aed",
            ];
            const color = colors[i % colors.length];
            return (
              <View key={s.name} className="flex-row items-center py-sm gap-sm">
                <View className="flex-row items-center gap-sm w-[80px]">
                  <View
                    className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}
                  />
                  <Text className="text-sm text-textSecondary font-medium">{s.name}</Text>
                </View>
                <View className="flex-1 h-2 bg-borderLight rounded-full overflow-hidden">
                  <View
                    className="h-full rounded-full" style={{ width: `${s.percentage}%`, backgroundColor: color + "80" }}
                  />
                </View>
                <Text className="text-xs text-textMuted w-[35px] text-right">{s.percentage}%</Text>
              </View>
            );
          })}
        </Card>

        {/* Quality Distribution */}
        <Text className="text-base text-textPrimary font-semibold mb-sm mt-xs">{t("upload.species")}</Text>
        <View className="flex-row gap-md mb-xl">
          {analytics?.qualityDistribution.map((q) => (
            <Card key={q.grade} padding={SPACING.md} className="flex-1 items-center">
              <View
                className="w-[10px] h-[10px] rounded-full mb-sm" style={{ backgroundColor: GRADE_COLORS[q.grade] }}
              />
              <Text
                className="text-sm font-bold" style={{ color: GRADE_COLORS[q.grade] }}
              >
                {q.grade}
              </Text>
              <Text className="text-xl text-textPrimary font-bold mt-xs">{q.count}</Text>
              <Text className="text-xs text-textMuted">{t("home.statCatches")}</Text>
            </Card>
          ))}
        </View>

        {/* Catch History */}
        <Text className="text-base text-textPrimary font-semibold mb-sm mt-xs">{t("upload.title")}</Text>
        {images &&
          images.length > 0 &&
          images.slice(0, 5).map((img) => (
            <Card
              key={img.imageId}
              padding={SPACING.md}
              className="mb-md"
            >
              <View className="flex-row justify-between items-center">
                <View className="flex-row items-center gap-md">
                  <Ionicons
                    name="fish-outline"
                    size={22}
                    color={COLORS.primaryLight}
                  />
                  <View>
                    <Text className="text-sm text-textPrimary font-semibold">
                      {img.status === "failed"
                        ? "Analysis Failed"
                        : (img.analysisResult?.species ?? "Pending")}
                    </Text>
                    <Text className="text-xs text-textMuted mt-[2px]">
                      {new Date(img.createdAt).toLocaleDateString("en-IN")}
                    </Text>
                  </View>
                </View>
                <View className="items-end gap-xs">
                  {img.status === "failed" ? (
                    <View
                      className="rounded-full px-sm py-[2px] bg-error/20"
                    >
                      <Text
                        className="text-xs font-bold text-error"
                      >
                        FAILED
                      </Text>
                    </View>
                  ) : img.analysisResult ? (
                    <>
                      <View
                        className="rounded-full px-sm py-[2px]" style={{ backgroundColor: GRADE_COLORS[img.analysisResult.qualityGrade ?? "Standard"] + "20" }}
                      >
                        <Text
                          className="text-xs font-bold" style={{ color: GRADE_COLORS[img.analysisResult.qualityGrade ?? "Standard"] }}
                        >
                          {img.analysisResult.qualityGrade ?? "-"}
                        </Text>
                      </View>
                      <Text className="text-sm text-textSecondary font-semibold">
                        {(img.analysisResult.measurements?.weight_g
                          ? img.analysisResult.measurements.weight_g / 1000
                          : img.analysisResult.weightEstimate
                        ).toFixed(2)}{" "}
                        kg
                      </Text>
                      <Text className="text-sm text-success font-bold">
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
                      className="rounded-full px-sm py-[2px] bg-warning/20"
                    >
                      <Text
                        className="text-xs font-bold text-warning"
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


