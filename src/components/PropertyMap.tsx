"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { supabase } from "@/lib/supabase";

const LONDON_CENTER: [number, number] = [-0.1276, 51.5072];
const DEFAULT_ZOOM = 11;

export type PropertyMarkerData = {
  id: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type PropertyMapHandle = {
  addMarker: (property: PropertyMarkerData) => void;
};

type PropertyMarkerRow = {
  id: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
};

/** Transit / transport layers should stay visible even if they look POI-like. */
function isTransitOrTransportLayer(
  layerId: string,
  sourceLayer?: string,
): boolean {
  const haystack = `${layerId} ${sourceLayer ?? ""}`.toLowerCase();
  return /transit|transport|railway|rail\b|station|subway|metro|tram|bus|ferry|airport|aerodrome|aeroway/.test(
    haystack,
  );
}

/**
 * Shops, restaurants, and general points of interest.
 * Street-name / road-label layers are intentionally not matched.
 */
function isPoiLayer(layerId: string, sourceLayer?: string): boolean {
  const id = layerId.toLowerCase();
  const source = (sourceLayer ?? "").toLowerCase();

  if (source === "poi" || source.startsWith("poi")) return true;
  if (
    /(^|[-_ ])poi([-_ .]|$)/.test(id) ||
    id.includes("poi-") ||
    id.startsWith("poi")
  ) {
    return true;
  }
  if (
    /shop|restaurant|fast[_-]?food|cafe|amenity|attraction|tourism|leisure/.test(
      id,
    )
  ) {
    return true;
  }
  return false;
}

function hidePoiLayers(map: maplibregl.Map) {
  const layers = map.getStyle().layers ?? [];
  const layerIds = layers.map((layer) => layer.id);
  console.log("Map style layer IDs:", layerIds);

  for (const layer of layers) {
    const sourceLayer =
      "source-layer" in layer
        ? (layer["source-layer"] as string | undefined)
        : undefined;

    if (isTransitOrTransportLayer(layer.id, sourceLayer)) {
      continue;
    }

    if (isPoiLayer(layer.id, sourceLayer)) {
      map.setLayoutProperty(layer.id, "visibility", "none");
    }
  }
}

function createPropertyMarker(
  map: maplibregl.Map,
  property: PropertyMarkerData,
): maplibregl.Marker {
  return new maplibregl.Marker()
    .setLngLat([property.longitude, property.latitude])
    .setPopup(new maplibregl.Popup({ offset: 24 }).setText(property.address))
    .addTo(map);
}

const PropertyMap = forwardRef<PropertyMapHandle>(function PropertyMap(
  _props,
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const markerIdsRef = useRef<Set<string>>(new Set());

  useImperativeHandle(ref, () => ({
    addMarker(property: PropertyMarkerData) {
      const map = mapRef.current;
      if (!map) return;
      if (markerIdsRef.current.has(property.id)) return;

      const marker = createPropertyMarker(map, property);
      markersRef.current.push(marker);
      markerIdsRef.current.add(property.id);
      map.flyTo({
        center: [property.longitude, property.latitude],
        zoom: Math.max(map.getZoom(), 13),
      });
    },
  }));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;
    if (!maptilerKey) {
      console.error(
        "Missing NEXT_PUBLIC_MAPTILER_KEY. Add it to .env.local to load the map.",
      );
      return;
    }

    const signal = { cancelled: false };
    const markers = markersRef.current;
    const markerIds = markerIdsRef.current;

    const map = new maplibregl.Map({
      container,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${maptilerKey}`,
      center: LONDON_CENTER,
      zoom: DEFAULT_ZOOM,
    });
    mapRef.current = map;

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true }),
      "top-right",
    );

    map.on("load", () => {
      if (signal.cancelled) return;
      hidePoiLayers(map);

      void (async () => {
        const { data, error } = await supabase
          .from("properties")
          .select("id, address, latitude, longitude");

        if (signal.cancelled) return;

        if (error) {
          console.error("Failed to fetch properties from Supabase:", error);
          return;
        }

        const properties = (data ?? []) as PropertyMarkerRow[];

        for (const property of properties) {
          if (property.latitude == null || property.longitude == null) continue;
          if (markerIds.has(property.id)) continue;

          const marker = createPropertyMarker(map, {
            id: property.id,
            address: property.address,
            latitude: property.latitude,
            longitude: property.longitude,
          });
          markers.push(marker);
          markerIds.add(property.id);
        }
      })();
    });

    return () => {
      signal.cancelled = true;
      for (const marker of markers) {
        marker.remove();
      }
      markers.length = 0;
      markerIds.clear();
      mapRef.current = null;
      map.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-full w-full min-h-[480px]"
      role="region"
      aria-label="Property map"
    />
  );
});

export default PropertyMap;
