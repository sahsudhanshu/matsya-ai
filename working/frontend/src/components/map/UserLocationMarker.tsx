"use client";

import { useEffect, useMemo, useState } from "react";
import { useMap } from "react-leaflet";
import { Circle, Marker, Tooltip } from "react-leaflet";
import L from "leaflet";

interface Props {
  /** Callback with user coords once acquired */
  onLocationFound?: (lat: number, lng: number) => void;
  /** Show 50km radius circle */
  showRadius?: boolean;
  /** Auto-center map on user location */
  autoCenter?: boolean;
}

export default function UserLocationMarker({
  onLocationFound,
  showRadius = true,
  autoCenter = true,
}: Props) {
  const map = useMap();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [hasMounted, setHasMounted] = useState(false);

  const pulseIcon = useMemo(() => L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:40px;height:40px;">
        <div style="
          position:absolute;top:50%;left:50%;
          width:16px;height:16px;
          transform:translate(-50%,-50%);
          background:rgba(59,130,246,1);
          border:3px solid white;
          border-radius:50%;
          box-shadow:0 0 8px rgba(59,130,246,0.6);
          z-index:2;
        "></div>
        <div style="
          position:absolute;top:50%;left:50%;
          width:40px;height:40px;
          transform:translate(-50%,-50%);
          background:rgba(59,130,246,0.25);
          border-radius:50%;
          animation:locPulse 2s ease-out infinite;
          z-index:1;
        "></div>
      </div>
      <style>
        @keyframes locPulse {
          0%   { transform:translate(-50%,-50%) scale(0.5); opacity:1; }
          100% { transform:translate(-50%,-50%) scale(2.2); opacity:0; }
        }
      </style>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  }), []);

  useEffect(() => {
    setHasMounted(true);
    if (!navigator.geolocation) return;

    let cancelled = false;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        onLocationFound?.(lat, lng);
        if (autoCenter) {
          map.flyTo([lat, lng], 11, { duration: 1.5 });
        }
      },
      () => {
        // Permission denied or error - silent fail
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );

    return () => {
      cancelled = true;
    };
  }, [map, onLocationFound, autoCenter]);

  // Inject tooltip styling
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .leaflet-tooltip-location {
        background: rgba(0,0,0,0.75) !important;
        color: white !important;
        border: 1px solid rgba(59,130,246,0.4) !important;
        border-radius: 8px !important;
        padding: 4px 10px !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        letter-spacing: 0.02em;
        backdrop-filter: blur(8px);
      }
      .leaflet-tooltip-location::before {
        border-top-color: rgba(0,0,0,0.75) !important;
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  if (!hasMounted || !coords) return null;

  return (
    <>
      <Marker position={[coords.lat, coords.lng]} icon={pulseIcon} zIndexOffset={1000}>
        <Tooltip
          permanent={false}
          direction="top"
          offset={[0, -24]}
          className="leaflet-tooltip-location"
        >
          You Are Here
        </Tooltip>
      </Marker>
      {showRadius && (
        <Circle
          center={[coords.lat, coords.lng]}
          radius={50000}
          pathOptions={{
            color: "rgba(59,130,246,0.5)",
            fillColor: "rgba(59,130,246,0.06)",
            fillOpacity: 1,
            weight: 2,
            dashArray: "8 6",
          }}
        />
      )}
    </>
  );
}
