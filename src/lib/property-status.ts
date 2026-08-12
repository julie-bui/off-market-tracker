import type { PropertyStatus } from "@/types/database";

/**
 * Selectable, current status options — drives the Add/Edit Property
 * dropdown and the map status legend. "coming_available_soon" is
 * intentionally excluded: it's retired as a selectable status but is
 * still a valid legacy value for existing records (see the label/colour
 * maps and LEGACY_STATUS_MAP below).
 */
export const PROPERTY_STATUSES: PropertyStatus[] = [
  "under_construction",
  "spacepoint_client",
  "undergoing_refurbishment",
  "has_planning_permission",
];

/** Labels for every known status, including retired/legacy ones. */
export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  coming_available_soon: "Coming Available Soon",
  under_construction: "Building under construction",
  spacepoint_client: "Spacepoint Client",
  undergoing_refurbishment: "Floor(s) undergoing refurbishment",
  has_planning_permission: "Has Planning Permission",
};

/** Pin colours for every known status, including retired/legacy ones. */
export const PROPERTY_STATUS_PIN_COLORS: Record<PropertyStatus, string> = {
  coming_available_soon: "#16a34a", // green — legacy, no longer selectable
  under_construction: "#d97706", // amber
  spacepoint_client: "#2563eb", // blue
  undergoing_refurbishment: "#7c3aed", // violet
  has_planning_permission: "#db2777", // pink
};

/** Map legacy DB statuses (pre-migration) onto the current options. */
const LEGACY_STATUS_MAP: Record<string, PropertyStatus> = {
  available: "coming_available_soon",
  under_offer: "under_construction",
  let: "spacepoint_client",
  withdrawn: "undergoing_refurbishment",
};

const KNOWN_STATUSES = Object.keys(PROPERTY_STATUS_LABELS);

export function normalizePropertyStatus(
  status: string | null | undefined,
): PropertyStatus {
  if (!status) return "coming_available_soon";
  if (KNOWN_STATUSES.includes(status)) {
    return status as PropertyStatus;
  }
  return LEGACY_STATUS_MAP[status] ?? "coming_available_soon";
}

export function propertyStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  const normalized = normalizePropertyStatus(status);
  return PROPERTY_STATUS_LABELS[normalized];
}
