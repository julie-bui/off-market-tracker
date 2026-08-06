"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type GeocodePreviewMapProps = {
  latitude: number;
  longitude: number;
  label?: string;
};

const PREVIEW_ZOOM = 15;
const MARKER_COLOR = "#92400e";

/** Small, non-scroll-jacking map preview for confirming a geocoded pin inline in a form. */
export default function GeocodePreviewMap({
  latitude,
  longitude,
  label,
}: GeocodePreviewMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;
    if (!maptilerKey) return;

    const map = new maplibregl.Map({
      container,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${maptilerKey}`,
      center: [longitude, latitude],
      zoom: PREVIEW_ZOOM,
    });

    // A small preview shouldn't hijack page scroll or gesture rotation.
    map.scrollZoom.disable();
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );

    markerRef.current = new maplibregl.Marker({ color: MARKER_COLOR })
      .setLngLat([longitude, latitude])
      .addTo(map);

    mapRef.current = map;

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current = null;
      map.remove();
    };
    // Map is created once; subsequent coordinate updates are applied via the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mapRef.current?.jumpTo({ center: [longitude, latitude] });
    markerRef.current?.setLngLat([longitude, latitude]);
  }, [latitude, longitude]);

  if (!process.env.NEXT_PUBLIC_MAPTILER_KEY) {
    return (
      <div className="flex h-40 w-full items-center justify-center rounded-md border border-amber-200 bg-amber-100 text-xs text-amber-800">
        Map preview unavailable (missing MapTiler key).
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-40 w-full overflow-hidden rounded-md border border-amber-200"
      role="img"
      aria-label={
        label
          ? `Map preview of the geocoded location: ${label}`
          : "Map preview of the geocoded location"
      }
    />
  );
}
