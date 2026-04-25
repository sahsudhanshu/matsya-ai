"use client";

import { useState, useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { Search } from "lucide-react";

interface Props {
    onSearchArea?: (bounds: { north: number; south: number; east: number; west: number }) => void;
}

export default function SearchThisArea({ onSearchArea }: Props) {
    const map = useMap();
    const [visible, setVisible] = useState(false);
    const initialCenter = useRef<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        // Store initial center on first render
        const center = map.getCenter();
        initialCenter.current = { lat: center.lat, lng: center.lng };

        const handleMoveEnd = () => {
            if (!initialCenter.current) return;
            const newCenter = map.getCenter();
            // Calculate distance from initial center
            const dlat = newCenter.lat - initialCenter.current.lat;
            const dlng = newCenter.lng - initialCenter.current.lng;
            const distKm = Math.sqrt(dlat ** 2 + dlng ** 2) * 111; // rough deg → km
            setVisible(distKm > 10);
        };

        map.on("moveend", handleMoveEnd);
        return () => { map.off("moveend", handleMoveEnd); };
    }, [map]);

    const handleClick = () => {
        const bounds = map.getBounds();
        const center = map.getCenter();
        initialCenter.current = { lat: center.lat, lng: center.lng };
        setVisible(false);
        onSearchArea?.({
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
        });
    };

    if (!visible) return null;

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
            <button
                onClick={handleClick}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full
          bg-card/90 backdrop-blur-xl border border-border/50 shadow-2xl
          text-sm font-bold text-foreground hover:bg-card
          transition-all hover:scale-105 active:scale-95
          animate-in fade-in slide-in-from-top-2 duration-200"
            >
                <Search className="w-4 h-4 text-primary" />
                Search This Area
            </button>
        </div>
    );
}
