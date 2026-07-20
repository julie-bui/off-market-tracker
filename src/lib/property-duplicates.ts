import { supabase } from "@/lib/supabase";

export type SimilarProperty = {
  id: string;
  address: string;
  postcode: string | null;
};

/** Normalize UK postcodes for comparison (strip spaces, uppercase). */
export function normalizePostcode(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const compact = trimmed.toUpperCase().replace(/\s+/g, "");
  return compact || null;
}

/** Pull a UK postcode out of free text when the postcode field is empty. */
export function extractPostcodeFromText(text: string): string | null {
  const match = text
    .toUpperCase()
    .match(/\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/);
  if (!match) return null;
  return `${match[1]}${match[2]}`;
}

function normalizeAddress(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * True when two address strings are exact, one contains the other, or they
 * share enough significant tokens to look like the same place.
 */
export function addressesLookSimilar(a: string, b: string): boolean {
  const left = normalizeAddress(a);
  const right = normalizeAddress(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;

  const leftTokens = new Set(
    a
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3),
  );
  const rightTokens = b
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);

  if (leftTokens.size === 0 || rightTokens.length === 0) return false;

  const overlap = rightTokens.filter((token) => leftTokens.has(token)).length;
  const minSize = Math.min(leftTokens.size, rightTokens.length);
  return overlap >= Math.max(2, Math.ceil(minSize * 0.6));
}

/**
 * Find an existing property that likely matches the address being entered.
 * Prefers postcode matches, then fuzzy/partial address matches.
 */
export async function findSimilarProperty(options: {
  address: string;
  postcode: string;
  excludeId?: string | null;
}): Promise<SimilarProperty | null> {
  const { data, error } = await supabase
    .from("properties")
    .select("id, address, postcode");

  if (error) {
    throw new Error(`Could not check for duplicate properties: ${error.message}`);
  }

  const rows = (data ?? []) as SimilarProperty[];
  const candidates = options.excludeId
    ? rows.filter((row) => row.id !== options.excludeId)
    : rows;

  if (candidates.length === 0) return null;

  const enteredPostcode =
    normalizePostcode(options.postcode) ??
    extractPostcodeFromText(options.address);

  if (enteredPostcode) {
    const byPostcode = candidates.find((row) => {
      const rowPostcode =
        normalizePostcode(row.postcode) ?? extractPostcodeFromText(row.address);
      return rowPostcode === enteredPostcode;
    });
    if (byPostcode) return byPostcode;
  }

  const byAddress = candidates.find((row) =>
    addressesLookSimilar(options.address, row.address),
  );

  return byAddress ?? null;
}
