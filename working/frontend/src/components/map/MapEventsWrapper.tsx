/**
 * MapEventsWrapper - client component that wraps the useMapEvents hook.
 *
 * useMapEvents is a React hook and CANNOT be dynamically imported via next/dynamic.
 * This component is loaded client-side by the parent page via:
 *   const MapEventsWrapper = dynamic(() => import('@/components/map/MapEventsWrapper'), { ssr: false })
 */
"use client"

import { useEffect, useRef } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';

interface MapBounds {
    north: number;
    south: number;
    east: number;
    west: number;
}

interface Props {
    onMouseMove: (pos: { lat: number; lng: number }) => void;
    onClick?: (pos: { lat: number; lng: number }) => void;
    onMapReady?: (map: L.Map) => void;
    onMoveEnd?: (bounds: MapBounds, center: { lat: number; lng: number }) => void;
}

export default function MapEventsWrapper({ onMouseMove, onClick, onMapReady, onMoveEnd }: Props) {
    const map = useMap();

    // Use a stable ref for callbacks to prevent resetting listeners unnecessarily
    const callbacks = useRef({ onMouseMove, onClick, onMapReady, onMoveEnd });

    useEffect(() => {
        callbacks.current = { onMouseMove, onClick, onMapReady, onMoveEnd };
    });

    useEffect(() => {
        if (map && callbacks.current.onMapReady) {
            callbacks.current.onMapReady(map);
        }
    }, [map]);

    const handlers = useRef({
        mousemove(e: L.LeafletMouseEvent) {
            callbacks.current.onMouseMove(e.latlng);
        },
        click(e: L.LeafletMouseEvent) {
            callbacks.current.onClick?.(e.latlng);
        },
        dragend() {
            triggerEnd();
        },
        zoomend() {
            triggerEnd();
        }
    });

    function triggerEnd() {
        if (callbacks.current.onMoveEnd) {
            const bounds = map.getBounds();
            const center = map.getCenter();
            callbacks.current.onMoveEnd(
                {
                    north: bounds.getNorth(),
                    south: bounds.getSouth(),
                    east: bounds.getEast(),
                    west: bounds.getWest(),
                },
                { lat: center.lat, lng: center.lng }
            );
        }
    }

    useMapEvents(handlers.current);

    return null;
}
