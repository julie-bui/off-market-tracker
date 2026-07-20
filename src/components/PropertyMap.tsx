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
import type { PropertyStatus } from "@/types/database";

const LONDON_CENTER: [number, number] = [-0.1276, 51.5072];
const DEFAULT_ZOOM = 13;

const STATUS_PIN_COLORS: Record<PropertyStatus, string> = {
  available: "#16a34a", // green
  under_offer: "#d97706", // amber
  let: "#6b7280", // gray
  withdrawn: "#6b7280", // gray
};

export type PropertyMarkerData = {
  id: string;
  address: string;
  latitude: number;
  longitude: number;
  status?: PropertyStatus | null;
};

export type PropertyMapHandle = {
  addMarker: (property: PropertyMarkerData) => void;
  updateMarker: (property: PropertyMarkerData) => void;
  removeMarker: (propertyId: string) => void;
};

type PropertyMapProps = {
  onPropertySelect?: (propertyId: string) => void;
  onMapBackgroundClick?: () => void;
};

type PropertyMarkerRow = {
  id: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: PropertyStatus | null;
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

function pinColorForStatus(status?: PropertyStatus | null): string {
  if (!status) return STATUS_PIN_COLORS.available;
  return STATUS_PIN_COLORS[status] ?? STATUS_PIN_COLORS.available;
}

/** Teardrop pin SVG — tip is at the bottom center of the viewBox. */
function createPinSvg(fill: string): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 40" width="28" height="40" aria-hidden="true" focusable="false">
      <path
        d="M14 0C6.268 0 0 6.268 0 14c0 9.625 12.042 24.292 12.554 24.906a1.87 1.87 0 0 0 2.892 0C16.958 38.292 28 23.625 28 14 28 6.268 21.732 0 14 0z"
        fill="${fill}"
        stroke="#ffffff"
        stroke-width="1.75"
      />
      <circle cx="14" cy="14" r="5" fill="#ffffff" fill-opacity="0.9" />
    </svg>
  `.trim();
}

function createMarkerElement(
  property: PropertyMarkerData,
  onSelect: (propertyId: string) => void,
): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "property-map-marker";
  el.title = property.address;
  el.setAttribute("aria-label", `View ${property.address}`);
  el.dataset.status = property.status ?? "available";
  el.innerHTML = createPinSvg(pinColorForStatus(property.status));
  el.addEventListener("click", (event) => {
    event.stopPropagation();
    onSelect(property.id);
  });
  return el;
}

function createPropertyMarker(
  map: maplibregl.Map,
  property: PropertyMarkerData,
  onSelect: (propertyId: string) => void,
): maplibregl.Marker {
  return new maplibregl.Marker({
    element: createMarkerElement(property, onSelect),
    anchor: "bottom",
  })
    .setLngLat([property.longitude, property.latitude])
    .addTo(map);
}

const PropertyMap = forwardRef<PropertyMapHandle, PropertyMapProps>(
  function PropertyMap({ onPropertySelect, onMapBackgroundClick }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const markersByIdRef = useRef(new Map<string, maplibregl.Marker>());
    const onSelectRef = useRef(onPropertySelect);
    const onBackgroundClickRef = useRef(onMapBackgroundClick);

    useEffect(() => {
      onSelectRef.current = onPropertySelect;
    }, [onPropertySelect]);

    useEffect(() => {
      onBackgroundClickRef.current = onMapBackgroundClick;
    }, [onMapBackgroundClick]);

    function selectProperty(propertyId: string) {
      onSelectRef.current?.(propertyId);
    }

    useImperativeHandle(ref, () => {
      function updateMarker(property: PropertyMarkerData) {
        const map = mapRef.current;
        if (!map) return;

        const existing = markersByIdRef.current.get(property.id);
        existing?.remove();

        const marker = createPropertyMarker(map, property, selectProperty);
        markersByIdRef.current.set(property.id, marker);
      }

      function addMarker(property: PropertyMarkerData) {
        const map = mapRef.current;
        if (!map) return;

        if (markersByIdRef.current.has(property.id)) {
          updateMarker(property);
          return;
        }

        const marker = createPropertyMarker(map, property, selectProperty);
        markersByIdRef.current.set(property.id, marker);
        map.flyTo({
          center: [property.longitude, property.latitude],
          zoom: Math.max(map.getZoom(), 13),
        });
      }

      function removeMarker(propertyId: string) {
        const marker = markersByIdRef.current.get(propertyId);
        marker?.remove();
        markersByIdRef.current.delete(propertyId);
      }

      return { addMarker, updateMarker, removeMarker };
    });

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
      const markersById = markersByIdRef.current;

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

      map.on("click", () => {
        onBackgroundClickRef.current?.();
      });

      map.on("load", () => {
        if (signal.cancelled) return;
        hidePoiLayers(map);

        void (async () => {
          const { data, error } = await supabase
            .from("properties")
            .select("id, address, latitude, longitude, status");

          if (signal.cancelled) return;

          if (error) {
            console.error("Failed to fetch properties from Supabase:", error);
            return;
          }

          const properties = (data ?? []) as PropertyMarkerRow[];

          for (const property of properties) {
            if (property.latitude == null || property.longitude == null) continue;
            if (markersById.has(property.id)) continue;

            const marker = createPropertyMarker(
              map,
              {
                id: property.id,
                address: property.address,
                latitude: property.latitude,
                longitude: property.longitude,
                status: property.status,
              },
              selectProperty,
            );
            markersById.set(property.id, marker);
          }
        })();
      });

      return () => {
        signal.cancelled = true;
        for (const marker of markersById.values()) {
          marker.remove();
        }
        markersById.clear();
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
  },
);

export default PropertyMap;
