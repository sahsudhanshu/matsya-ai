import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWeatherData } from './api-client';
import type { WeatherData } from './types';

const WEATHER_CACHE_KEY = 'ocean_ai_weather_cache';
const WEATHER_CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

export class WeatherService {
  /**
   * Get weather data with caching
   */
  static async getWeather(
    latitude: number,
    longitude: number,
    forceRefresh = false
  ): Promise<WeatherData> {
    const cacheKey = `${WEATHER_CACHE_KEY}_${latitude.toFixed(2)}_${longitude.toFixed(2)}`;

    if (!forceRefresh) {
      const cached = await this.getCachedWeather(cacheKey);
      if (cached) return cached;
    }

    const weather = await getWeatherData(latitude, longitude);
    await this.cacheWeather(cacheKey, weather);
    return weather;
  }

  /**
   * Calculate sunrise and sunset times
   */
  static calculateSunTimes(
    latitude: number,
    longitude: number,
    date: Date = new Date()
  ): { sunrise: string; sunset: string } {
    // Simplified calculation - in production, use a library like suncalc
    const dayOfYear = Math.floor(
      (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
    );
    const solarNoon = 12 - longitude / 15;
    const dayLength = 12 + 4 * Math.sin((2 * Math.PI * (dayOfYear - 80)) / 365);

    const sunrise = solarNoon - dayLength / 2;
    const sunset = solarNoon + dayLength / 2;

    return {
      sunrise: this.formatTime(sunrise),
      sunset: this.formatTime(sunset),
    };
  }

  /**
   * Get moon phase
   */
  static getMoonPhase(date: Date = new Date()): {
    phase: string;
    illumination: number;
    emoji: string;
  } {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    // Simplified moon phase calculation
    const c = Math.floor((year - 2000) / 100);
    const e = 2 * (year - 2000) - c;
    const jd = Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day - 1524.5;
    const daysSinceNew = (jd - 2451549.5) % 29.53;
    const phase = daysSinceNew / 29.53;

    let phaseName: string;
    let emoji: string;

    if (phase < 0.0625 || phase >= 0.9375) {
      phaseName = 'New Moon';
      emoji = '🌑';
    } else if (phase < 0.1875) {
      phaseName = 'Waxing Crescent';
      emoji = '🌒';
    } else if (phase < 0.3125) {
      phaseName = 'First Quarter';
      emoji = '🌓';
    } else if (phase < 0.4375) {
      phaseName = 'Waxing Gibbous';
      emoji = '🌔';
    } else if (phase < 0.5625) {
      phaseName = 'Full Moon';
      emoji = '🌕';
    } else if (phase < 0.6875) {
      phaseName = 'Waning Gibbous';
      emoji = '🌖';
    } else if (phase < 0.8125) {
      phaseName = 'Last Quarter';
      emoji = '🌗';
    } else {
      phaseName = 'Waning Crescent';
      emoji = '🌘';
    }

    return {
      phase: phaseName,
      illumination: Math.abs(Math.cos(phase * 2 * Math.PI)),
      emoji,
    };
  }

  /**
   * Get cached weather data
   */
  private static async getCachedWeather(key: string): Promise<WeatherData | null> {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (!cached) return null;

      const { weather, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      if (age > WEATHER_CACHE_DURATION) {
        await AsyncStorage.removeItem(key);
        return null;
      }

      return weather;
    } catch {
      return null;
    }
  }

  /**
   * Cache weather data
   */
  private static async cacheWeather(key: string, weather: WeatherData): Promise<void> {
    try {
      await AsyncStorage.setItem(
        key,
        JSON.stringify({ weather, timestamp: Date.now() })
      );
    } catch (error) {
      console.error('Failed to cache weather:', error);
    }
  }

  /**
   * Format time from decimal hours
   */
  private static formatTime(decimalHours: number): string {
    const hours = Math.floor(decimalHours);
    const minutes = Math.floor((decimalHours - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
}
