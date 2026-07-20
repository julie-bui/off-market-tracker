export type GeocodeResult = {
  latitude: number;
  longitude: number;
  placeName: string;
};

type MapTilerGeocodingFeature = {
  center?: [number, number];
  place_name?: string;
  geometry?: {
    type?: string;
    coordinates?: [number, number] | number[];
  };
};

type MapTilerGeocodingResponse = {
  features?: MapTilerGeocodingFeature[];
};

/**
 * Forward-geocode an address with MapTiler.
 * Throws a user-facing Error when the address can't be resolved.
 */
export async function geocodeAddress(
  query: string,
  maptilerKey: string,
): Promise<GeocodeResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("Enter an address to place the property on the map.");
  }

  const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(trimmed)}.json?key=${encodeURIComponent(maptilerKey)}`;

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
  const feature = data.features?.[0];

  if (!feature) {
    throw new Error(
      `No location found for “${trimmed}”. Try a fuller street address or postcode.`,
    );
  }

  const coords =
    feature.center ??
    (feature.geometry?.type === "Point"
      ? (feature.geometry.coordinates as [number, number] | undefined)
      : undefined);

  if (!coords || coords.length < 2 || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) {
    throw new Error(
      `No usable coordinates returned for “${trimmed}”. Try a different address.`,
    );
  }

  const [longitude, latitude] = coords;

  return {
    latitude,
    longitude,
    placeName: feature.place_name ?? trimmed,
  };
}
