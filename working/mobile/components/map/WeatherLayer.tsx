import React from 'react';
import { UrlTile } from 'react-native-maps';
import type { Region } from 'react-native-maps';

interface WeatherLayerProps {
  region: Region;
  layerType: 'temperature' | 'currents' | 'salinity' | 'none';
  apiKey: string;
  onMarkerPress?: (marker: WeatherMarker) => void;
}

export interface WeatherMarker {
  latitude: number;
  longitude: number;
  temperature?: number;
  windSpeed?: number;
  windDirection?: number;
}

export function WeatherLayer({
  region,
  layerType,
  apiKey,
  onMarkerPress,
}: WeatherLayerProps): React.ReactElement | null {
  if (layerType === 'none' || !apiKey) {
    return null;
  }

  // Map layer types to OpenWeatherMap layer IDs
  const layerMap: Record<string, string> = {
    temperature: 'temp_new',
    currents: 'wind_new',
    salinity: 'pressure_new', // Using pressure as proxy for salinity
  };

  const owmLayerId = layerMap[layerType] || 'temp_new';
  const tileUrl = `https://tile.openweathermap.org/map/${owmLayerId}/{z}/{x}/{y}.png?appid=${apiKey}`;

  return (
    <UrlTile
      urlTemplate={tileUrl}
      maximumZ={19}
      opacity={0.7}
      zIndex={1}
    />
  );
}
