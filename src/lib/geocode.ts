export type GeocodeResult = {
  latitude: number;
  longitude: number;
  placeName: string;
  /** Google's geocode precision indicator (e.g. "ROOFTOP", "APPROXIMATE"). */
  locationType: string;
};

type GeocodeApiSuccess = {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  locationType: string;
};

type GeocodeApiError = {
  error: string;
};

/**
 * Greater London bounding box (WGS84): west, south, east, north.
 * Covers Greater London; used to bias the geocoder and to hard-reject
 * results outside it.
 */
export const LONDON_BBOX = {
  west: -0.55,
  south: 51.28,
  east: 0.35,
  north: 51.7,
} as const;

export const LONDON_ONLY_MESSAGE =
  "Address must be in London, UK. Try a London street address or postcode.";

/**
 * Google location_type values below ROOFTOP/RANGE_INTERPOLATED precision —
 * ask the user to confirm/adjust the pin for these.
 * https://developers.google.com/maps/documentation/geocoding/requests-geocoding#Types
 */
const LOW_CONFIDENCE_LOCATION_TYPES = new Set<string>([
  "GEOMETRIC_CENTER",
  "APPROXIMATE",
]);

export function isLowConfidenceMatch(locationType: string): boolean {
  return LOW_CONFIDENCE_LOCATION_TYPES.has(locationType);
}

const LOCATION_TYPE_LABELS: Record<string, string> = {
  ROOFTOP: "an exact rooftop match",
  RANGE_INTERPOLATED: "an interpolated match along the street",
  GEOMETRIC_CENTER: "the geometric center of an area, not a specific address",
  APPROXIMATE: "only an approximate area, not a specific address",
};

/** Human-readable description of a Google location_type, for the low-confidence warning. */
export function describeLocationType(locationType: string): string {
  return (
    LOCATION_TYPE_LABELS[locationType] ??
    `a low-confidence match (${locationType})`
  );
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

function normalizeForComparison(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

/**
 * Join address + postcode into one geocode query, without repeating the
 * postcode if the user already typed it as part of the free-text address
 * (e.g. address "1 Poultry, London EC2R 8EJ" + postcode "EC2R 8EJ").
 */
export function buildGeocodeQuery(address: string, postcode: string): string {
  const trimmedAddress = address.trim();
  const trimmedPostcode = postcode.trim();
  if (!trimmedPostcode) return trimmedAddress;

  const normalizedPostcode = normalizeForComparison(trimmedPostcode);
  if (normalizeForComparison(trimmedAddress).includes(normalizedPostcode)) {
    return trimmedAddress;
  }

  return [trimmedAddress, trimmedPostcode].filter(Boolean).join(", ");
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

/**
 * Forward-geocode an address via our own /api/geocode route (backed by
 * Google's Geocoding API, server-side key) — London, UK only.
 */
export async function geocodeAddress(query: string): Promise<GeocodeResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("Enter an address to place the property on the map.");
  }

  const londonQuery = withLondonContext(trimmed);
  const url = `/api/geocode?address=${encodeURIComponent(londonQuery)}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error(
      "Geocoding failed because the network request could not be completed. Check your connection and try again.",
    );
  }

  const data = (await response.json().catch(() => null)) as
    | GeocodeApiSuccess
    | GeocodeApiError
    | null;

  if (process.env.NODE_ENV !== "production") {
    console.debug("[geocode] /api/geocode response for %o:", londonQuery, data);
  }

  if (!response.ok || !data || "error" in data) {
    if (response.status === 404) {
      throw new Error(ADDRESS_NOT_FOUND_MESSAGE);
    }
    throw new Error(
      data && "error" in data ? data.error : "Geocoding failed. Try again.",
    );
  }

  const { latitude, longitude, formattedAddress, locationType } = data;

  if (!isWithinLondon(latitude, longitude)) {
    throw new Error(LONDON_ONLY_MESSAGE);
  }

  return {
    latitude,
    longitude,
    placeName: formattedAddress,
    locationType,
  };
}
