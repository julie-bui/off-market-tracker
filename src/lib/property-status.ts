import type { PropertyStatus } from "@/types/database";

export const PROPERTY_STATUSES: PropertyStatus[] = [
  "coming_available_soon",
  "under_construction",
  "spacepoint_client",
  "undergoing_refurbishment",
  "has_planning_permission",
];

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  coming_available_soon: "Coming Available Soon",
  under_construction: "Under Construction",
  spacepoint_client: "Spacepoint Client",
  undergoing_refurbishment: "Undergoing Re-furbishment",
  has_planning_permission: "Has Planning Permission",
};

export const PROPERTY_STATUS_PIN_COLORS: Record<PropertyStatus, string> = {
  coming_available_soon: "#16a34a", // green
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

export function normalizePropertyStatus(
  status: string | null | undefined,
): PropertyStatus {
  if (!status) return "coming_available_soon";
  if ((PROPERTY_STATUSES as string[]).includes(status)) {
    return status as PropertyStatus;
  }
  return LEGACY_STATUS_MAP[status] ?? "coming_available_soon";
}

export function propertyStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  const normalized = normalizePropertyStatus(status);
  return PROPERTY_STATUS_LABELS[normalized];
}
