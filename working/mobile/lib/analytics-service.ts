import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAnalytics } from "./api-client";
import type { AnalyticsResponse } from "./api-client";

const ANALYTICS_CACHE_KEY = "ocean_ai_analytics_cache";
const ANALYTICS_CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

/**
 * Service for managing analytics data with caching
 */
export class AnalyticsService {
  /**
   * Get analytics with caching
   */
  static async getAnalytics(
    forceRefresh = false,
  ): Promise<AnalyticsResponse | null> {
    if (!forceRefresh) {
      const cached = await this.getCachedAnalytics();
      if (cached) return cached;
    }

    try {
      const analytics = await getAnalytics();
      await this.cacheAnalytics(analytics);
      return analytics;
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
      // Return cached analytics as fallback
      return await this.getCachedAnalytics();
    }
  }

  /**
   * Get cached analytics if valid
   */
  private static async getCachedAnalytics(): Promise<AnalyticsResponse | null> {
    try {
      const cached = await AsyncStorage.getItem(ANALYTICS_CACHE_KEY);
      if (!cached) return null;

      const { analytics, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      if (age > ANALYTICS_CACHE_DURATION) {
        await AsyncStorage.removeItem(ANALYTICS_CACHE_KEY);
        return null;
      }

      return analytics;
    } catch (error) {
      console.error("Failed to parse cached analytics:", error);
      // Clear corrupted cache
      await AsyncStorage.removeItem(ANALYTICS_CACHE_KEY).catch(() => {});
      return null;
    }
  }

  /**
   * Cache analytics with timestamp
   */
  private static async cacheAnalytics(
    analytics: AnalyticsResponse,
  ): Promise<void> {
    try {
      await AsyncStorage.setItem(
        ANALYTICS_CACHE_KEY,
        JSON.stringify({ analytics, timestamp: Date.now() }),
      );
    } catch (error) {
      console.error("Failed to cache analytics:", error);
    }
  }

  /**
   * Get cache timestamp for "last updated" display
   */
  static async getCacheTimestamp(): Promise<Date | null> {
    try {
      const cached = await AsyncStorage.getItem(ANALYTICS_CACHE_KEY);
      if (!cached) return null;

      const { timestamp } = JSON.parse(cached);
      return new Date(timestamp);
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear analytics cache
   */
  static async clearCache(): Promise<void> {
    await AsyncStorage.removeItem(ANALYTICS_CACHE_KEY);
  }
}
