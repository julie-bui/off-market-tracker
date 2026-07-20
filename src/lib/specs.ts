/**
 * Specs are stored as plain text. Older rows may still contain a JSON
 * wrapper like {"text":"..."}; unwrap those for display and on save.
 */

export function specsToPlainText(specs: unknown): string {
  if (specs == null) return "";

  if (typeof specs === "object" && !Array.isArray(specs)) {
    const record = specs as Record<string, unknown>;
    if (typeof record.text === "string") return specsToPlainText(record.text);
    if (Object.keys(record).length === 0) return "";
    return "";
  }

  if (typeof specs === "string") {
    const trimmed = specs.trim();
    if (!trimmed) return "";

    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
      try {
        return specsToPlainText(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }

    return trimmed;
  }

  return String(specs);
}

/** Value to persist on properties.specs — plain text or null, never JSON. */
export function specsForSave(raw: string): string | null {
  const plain = specsToPlainText(raw).trim();
  return plain || null;
}

/** Display helper for the detail panel. */
export function formatSpecsForDisplay(specs: unknown): string {
  const plain = specsToPlainText(specs);
  return plain || "—";
}
