/**
 * Single Street View URL builder for the whole app.
 *
 * Uses Google Maps URLs API only:
 * https://www.google.com/maps/@?api=1&map_action=pano&viewpoint={latitude},{longitude}
 *
 * Note: after opening, Google may rewrite the browser address bar to an
 * internal viewer path. That redirect is Google's — this app never builds it.
 */

const STREET_VIEW_PREFIX =
  "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=";

export function buildStreetViewUrl(
  latitude: number,
  longitude: number,
): string {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Invalid property coordinates for Street View");
  }

  return STREET_VIEW_PREFIX + String(lat) + "," + String(lng);
}

/** Log the final URL, then open it in a new tab. */
export function openStreetView(latitude: number, longitude: number): void {
  const url = buildStreetViewUrl(latitude, longitude);

  if (!url.startsWith(STREET_VIEW_PREFIX) || (url.match(/https?:\/\//g) ?? []).length !== 1) {
    console.error("Refusing to open malformed Street View URL:", url);
    return;
  }

  console.log(url);

  const anchor = document.createElement("a");
  anchor.setAttribute("href", url);
  anchor.setAttribute("target", "_blank");
  anchor.setAttribute("rel", "noopener noreferrer");
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
