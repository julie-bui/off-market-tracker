import type { PropertyStatus } from "@/types/database";

export const PROPERTY_STATUSES: PropertyStatus[] = [
  "coming_available_soon",
  "under_construction",
  "spacepoint_client",
  "undergoing_refurbishment",
];

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  coming_available_soon: "Coming Available Soon",
  under_construction: "Under Construction",
  spacepoint_client: "Spacepoint Client",
  undergoing_refurbishment: "Undergoing Re-furbishment",
};

export const PROPERTY_STATUS_PIN_COLORS: Record<PropertyStatus, string> = {
  coming_available_soon: "#16a34a", // green
  under_construction: "#d97706", // amber
  spacepoint_client: "#2563eb", // blue
  undergoing_refurbishment: "#7c3aed", // violet
};

export function propertyStatusLabel(status: PropertyStatus | null | undefined): string {
  if (!status) return "—";
  return PROPERTY_STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}
