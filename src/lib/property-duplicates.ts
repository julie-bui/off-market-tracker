import { supabase } from "@/lib/supabase";

export type SimilarProperty = {
  id: string;
  address: string;
  postcode: string | null;
};

/** Lowercase + trim for case-insensitive comparisons. */
export function normalizeComparable(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Normalize UK postcodes for comparison:
 * trim, lowercase (via upper then compact), strip internal spaces.
 * "EC3A 8BF" and "ec3a 8bf" both become "ec3a8bf".
 */
export function normalizePostcode(
  value: string | null | undefined,
): string | null {
  const trimmed = normalizeComparable(value);
  if (!trimmed) return null;
  const compact = trimmed.replace(/\s+/g, "");
  return compact || null;
}

/** Pull a UK postcode out of free text when the postcode field is empty. */
export function extractPostcodeFromText(text: string): string | null {
  const match = text
    .toUpperCase()
    .match(/\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/);
  if (!match) return null;
  return normalizePostcode(`${match[1]}${match[2]}`);
}

function normalizeAddress(value: string): string {
  return normalizeComparable(value).replace(/[^a-z0-9]/g, "");
}

/**
 * True when two address strings are exact (case-insensitive), one contains
 * the other, or they share enough significant tokens to look like the same place.
 */
export function addressesLookSimilar(a: string, b: string): boolean {
  const leftRaw = normalizeComparable(a);
  const rightRaw = normalizeComparable(b);
  if (!leftRaw || !rightRaw) return false;
  if (leftRaw === rightRaw) return true;

  const left = normalizeAddress(a);
  const right = normalizeAddress(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;

  const leftTokens = new Set(
    leftRaw.split(/[^a-z0-9]+/).filter((token) => token.length >= 3),
  );
  const rightTokens = rightRaw
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);

  if (leftTokens.size === 0 || rightTokens.length === 0) return false;

  const overlap = rightTokens.filter((token) => leftTokens.has(token)).length;
  const minSize = Math.min(leftTokens.size, rightTokens.length);
  return overlap >= Math.max(2, Math.ceil(minSize * 0.6));
}

export function postcodesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = normalizePostcode(a);
  const right = normalizePostcode(b);
  return left != null && right != null && left === right;
}

/**
 * Pure matcher used by findSimilarProperty (and unit tests).
 * Prefers: same postcode → case-insensitive address → fuzzy address.
 */
export function findSimilarPropertyInList(
  candidates: SimilarProperty[],
  options: { address: string; postcode: string; excludeId?: string | null },
): SimilarProperty | null {
  const rows = options.excludeId
    ? candidates.filter((row) => row.id !== options.excludeId)
    : candidates;

  if (rows.length === 0) return null;

  const enteredPostcode =
    normalizePostcode(options.postcode) ??
    extractPostcodeFromText(options.address);

  // 1) Case-insensitive postcode match (field or extracted from address).
  if (enteredPostcode) {
    const byPostcode = rows.find((row) => {
      const rowPostcode =
        normalizePostcode(row.postcode) ?? extractPostcodeFromText(row.address);
      return rowPostcode != null && rowPostcode === enteredPostcode;
    });
    if (byPostcode) return byPostcode;
  }

  // 2) Case-insensitive exact / fuzzy address match.
  const byAddress = rows.find((row) =>
    addressesLookSimilar(options.address, row.address),
  );

  return byAddress ?? null;
}

/**
 * Find an existing property that likely matches the address being entered.
 */
export async function findSimilarProperty(options: {
  address: string;
  postcode: string;
  excludeId?: string | null;
}): Promise<SimilarProperty | null> {
  const { data, error } = await supabase
    .from("properties")
    .select("id, address, postcode")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(
      `Could not check for duplicate properties: ${error.message}`,
    );
  }

  const match = findSimilarPropertyInList(
    (data ?? []) as SimilarProperty[],
    options,
  );

  if (match) {
    console.log("[duplicate-check] match found", {
      entered: { address: options.address, postcode: options.postcode },
      match,
    });
  } else {
    console.log("[duplicate-check] no match", {
      entered: { address: options.address, postcode: options.postcode },
      scanned: (data ?? []).length,
    });
  }

  return match;
}
