"use client";

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ExternalLink, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import 'leaflet/dist/leaflet.css';

// Dynamic imports to avoid SSR issues with Leaflet
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const LeafMarker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false });

// Fix default marker icons on load
if (typeof window !== 'undefined') {
  import('leaflet').then(L => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  });
}

const MAP_TILE = "https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}";

interface InlineMiniMapProps {
  lat: number;
  lon: number;
  onClick?: () => void;
  className?: string;
}

/**
 * Compact Leaflet map preview rendered inside a chat bubble.
 * Shows a marker at the given coordinates. Clicking the overlay opens
 * the full map in the side panel.
 */
export default function InlineMiniMap({ lat, lon, onClick, className }: InlineMiniMapProps) {
  const center = useMemo<[number, number]>(() => [lat, lon], [lat, lon]);

  return (
    <div
      className={cn(
        "relative mt-1 rounded-xl overflow-hidden border border-border/30 shadow-sm w-full max-w-[320px] group cursor-pointer",
        className,
      )}
      onClick={onClick}
      title="Click to open in map"
    >
      {/* Leaflet map - interactions disabled, purely visual */}
      <div className="h-[140px] pointer-events-none">
        <MapContainer
          center={center}
          zoom={11}
          zoomControl={false}
          dragging={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          touchZoom={false}
          attributionControl={false}
          className="w-full h-full z-10"
          style={{ background: '#0a1628' }}
        >
          <TileLayer url={MAP_TILE} maxZoom={18} />
          <LeafMarker position={center} />
        </MapContainer>
      </div>

      {/* Footer bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-card/80 backdrop-blur-sm border-t border-border/20">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3 text-cyan-500" />
          <span className="font-medium">{lat.toFixed(4)}°N, {lon.toFixed(4)}°E</span>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          <ExternalLink className="w-3 h-3" /> Open
        </span>
      </div>
    </div>
  );
}
