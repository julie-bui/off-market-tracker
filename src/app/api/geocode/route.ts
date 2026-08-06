import { NextRequest, NextResponse } from "next/server";

import { LONDON_BBOX } from "@/lib/geocode";

const GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

type GoogleGeocodeResult = {
  formatted_address?: string;
  geometry?: {
    location?: { lat?: number; lng?: number };
    location_type?: string;
  };
};

type GoogleGeocodeResponse = {
  status?: string;
  results?: GoogleGeocodeResult[];
  error_message?: string;
};

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")?.trim();
  if (!address) {
    return NextResponse.json(
      { error: "Missing 'address' query parameter." },
      { status: 400 },
    );
  }

  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Geocoding is not configured. Ask an admin to set GOOGLE_GEOCODING_API_KEY.",
      },
      { status: 500 },
    );
  }

  const params = new URLSearchParams({
    address,
    key: apiKey,
    region: "gb",
    components: "country:GB",
    // Google's bounds bias is lat,lng order — unlike the lng,lat bbox we used for MapTiler.
    bounds: `${LONDON_BBOX.south},${LONDON_BBOX.west}|${LONDON_BBOX.north},${LONDON_BBOX.east}`,
  });

  let response: Response;
  try {
    response = await fetch(`${GOOGLE_GEOCODE_URL}?${params.toString()}`);
  } catch {
    return NextResponse.json(
      { error: "Could not reach Google's geocoding service." },
      { status: 502 },
    );
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: "Google's geocoding service returned an error." },
      { status: 502 },
    );
  }

  const data = (await response.json()) as GoogleGeocodeResponse;

  if (data.status !== "OK" || !data.results || data.results.length === 0) {
    return NextResponse.json(
      { error: data.error_message ?? "No results found for this address." },
      { status: 404 },
    );
  }

  const top = data.results[0];
  const lat = top.geometry?.location?.lat;
  const lng = top.geometry?.location?.lng;

  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json(
      { error: "Google's response did not include usable coordinates." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    latitude: lat,
    longitude: lng,
    formattedAddress: top.formatted_address ?? address,
    locationType: top.geometry?.location_type ?? "APPROXIMATE",
  });
}
