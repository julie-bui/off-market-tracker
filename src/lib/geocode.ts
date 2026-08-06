export type GeocodeResult = {
  latitude: number;
  longitude: number;
  placeName: string;
  /** MapTiler match confidence, 0–1. Missing scores are treated as fully confident (1). */
  relevance: number;
};

type MapTilerGeocodingFeature = {
  center?: [number, number];
  place_name?: string;
  relevance?: number;
  geometry?: {
    type?: string;
    coordinates?: [number, number] | number[];
  };
};

type MapTilerGeocodingResponse = {
  features?: MapTilerGeocodingFeature[];
};

/**
 * Greater London bounding box (WGS84): west, south, east, north.
 * Covers Greater London; used to bias MapTiler and to hard-reject results outside.
 */
export const LONDON_BBOX = {
  west: -0.55,
  south: 51.28,
  east: 0.35,
  north: 51.7,
} as const;

/** Central London — proximity bias for ranking. */
export const LONDON_PROXIMITY: [number, number] = [-0.1276, 51.5072];

export const LONDON_ONLY_MESSAGE =
  "Address must be in London, UK. Try a London street address or postcode.";

/** Below this MapTiler relevance score, ask the user to confirm/adjust the pin. */
export const LOW_CONFIDENCE_RELEVANCE_THRESHOLD = 0.7;

export function isLowConfidenceMatch(relevance: number): boolean {
  return relevance < LOW_CONFIDENCE_RELEVANCE_THRESHOLD;
}

const ADDRESS_NOT_FOUND_MESSAGE =
  "Address not found in London — try adding more detail like postcode or building name.";

export function isWithinLondon(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    longitude >= LONDON_BBOX.west &&
    longitude <= LONDON_BBOX.east &&
    latitude >= LONDON_BBOX.south &&
    latitude <= LONDON_BBOX.north
  );
}

/** Prefer queries that already mention London/UK; otherwise append it. */
export function withLondonContext(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return trimmed;
  if (/\blondon\b/i.test(trimmed) || /\buk\b/i.test(trimmed) || /\bunited kingdom\b/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}, London, UK`;
}

function buildGeocodeUrl(query: string, maptilerKey: string): string {
  const params = new URLSearchParams({
    key: maptilerKey,
    // Restrict country to Great Britain
    country: "gb",
    // Limit search area to Greater London
    bbox: [
      LONDON_BBOX.west,
      LONDON_BBOX.south,
      LONDON_BBOX.east,
      LONDON_BBOX.north,
    ].join(","),
    // Rank London-central matches higher
    proximity: `${LONDON_PROXIMITY[0]},${LONDON_PROXIMITY[1]}`,
    limit: "5",
    language: "en",
  });

  return `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?${params.toString()}`;
}

function featureCoordinates(
  feature: MapTilerGeocodingFeature,
): [number, number] | null {
  const coords =
    feature.center ??
    (feature.geometry?.type === "Point"
      ? (feature.geometry.coordinates as [number, number] | undefined)
      : undefined);

  if (
    !coords ||
    coords.length < 2 ||
    !Number.isFinite(coords[0]) ||
    !Number.isFinite(coords[1])
  ) {
    return null;
  }

  return [coords[0], coords[1]];
}

/**
 * Forward-geocode an address with MapTiler — London, UK only.
 * Uses country=gb + Greater London bbox, then rejects any hit outside the box.
 */
export async function geocodeAddress(
  query: string,
  maptilerKey: string,
): Promise<GeocodeResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("Enter an address to place the property on the map.");
  }

  const londonQuery = withLondonContext(trimmed);
  const url = buildGeocodeUrl(londonQuery, maptilerKey);

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error(
      "Geocoding failed because the network request could not be completed. Check your connection and try again.",
    );
  }

  if (!response.ok) {
    throw new Error(
      "Geocoding failed. Check that NEXT_PUBLIC_MAPTILER_KEY is valid and try again.",
    );
  }

  const data = (await response.json()) as MapTilerGeocodingResponse;
  const features = data.features ?? [];

  // Prefer the first London-in-bbox result (API may still return near-misses).
  for (const feature of features) {
    const coords = featureCoordinates(feature);
    if (!coords) continue;

    const [longitude, latitude] = coords;
    if (!isWithinLondon(latitude, longitude)) continue;

    const relevance =
      typeof feature.relevance === "number" && Number.isFinite(feature.relevance)
        ? feature.relevance
        : 1;

    return {
      latitude,
      longitude,
      placeName: feature.place_name ?? trimmed,
      relevance,
    };
  }

  if (features.length > 0) {
    throw new Error(LONDON_ONLY_MESSAGE);
  }

  throw new Error(ADDRESS_NOT_FOUND_MESSAGE);
}
