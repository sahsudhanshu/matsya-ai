import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserProfile, updateUserProfile } from './api-client';
import type { UserProfile } from './types';

const PROFILE_CACHE_KEY = 'ocean_ai_profile_cache';
const PROFILE_CACHE_DURATION = 1000 * 60 * 60; // 1 hour

/**
 * Service for managing user profile data with caching
 */
export class ProfileService {
  /**
   * Get user profile with caching
   */
  static async getProfile(forceRefresh = false): Promise<UserProfile | null> {
    if (!forceRefresh) {
      const cached = await this.getCachedProfile();
      if (cached) return cached;
    }

    try {
      const profile = await getUserProfile();
      await this.cacheProfile(profile);
      return profile;
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      // Return cached profile as fallback
      return await this.getCachedProfile();
    }
  }

  /**
   * Update user profile and invalidate cache
   */
  static async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const profile = await updateUserProfile(updates);
    await this.cacheProfile(profile);
    return profile;
  }

  /**
   * Get cached profile if valid
   */
  private static async getCachedProfile(): Promise<UserProfile | null> {
    try {
      const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
      if (!cached) return null;

      const { profile, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      if (age > PROFILE_CACHE_DURATION) {
        await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
        return null;
      }

      return profile;
    } catch (error) {
      console.error('Failed to parse cached profile:', error);
      // Clear corrupted cache
      await AsyncStorage.removeItem(PROFILE_CACHE_KEY).catch(() => {});
      return null;
    }
  }

  /**
   * Cache profile with timestamp
   */
  private static async cacheProfile(profile: UserProfile): Promise<void> {
    try {
      await AsyncStorage.setItem(
        PROFILE_CACHE_KEY,
        JSON.stringify({ profile, timestamp: Date.now() })
      );
    } catch (error) {
      console.error('Failed to cache profile:', error);
    }
  }

  /**
   * Clear profile cache
   */
  static async clearCache(): Promise<void> {
    await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
  }
}
