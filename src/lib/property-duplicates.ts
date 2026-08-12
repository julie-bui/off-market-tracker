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
 * trim, lowercase, strip internal spaces.
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

const UK_POSTCODE_PATTERN = /\b[a-z]{1,2}\d[a-z\d]?\s*\d[a-z]{2}\b/i;

/** Pull a UK postcode out of free text when the postcode field is empty. */
export function extractPostcodeFromText(text: string): string | null {
  const match = text.match(UK_POSTCODE_PATTERN);
  if (!match) return null;
  return normalizePostcode(match[0]);
}

/**
 * Postcode equality alone is never used to flag a duplicate (see
 * addressesLookSimilar) — this is kept as a small standalone helper for
 * anywhere postcode equality is a useful signal on its own.
 */
export function postcodesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = normalizePostcode(a);
  const right = normalizePostcode(b);
  return left != null && right != null && left === right;
}

/**
 * Strip formatting noise from an address — postcode, the word "London",
 * and punctuation — leaving lowercase, comma-separated segments.
 */
function stripAddressNoise(value: string): string {
  let text = normalizeComparable(value);
  text = text.replace(UK_POSTCODE_PATTERN, " ");
  text = text.replace(/\blondon\b/g, " ");
  text = text.replace(/[^a-z0-9\s,]/g, " ");
  return text
    .split(",")
    .map((segment) => segment.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(", ");
}

const LEADING_NUMBER_PATTERN = /^\d+[a-z]?\b/;

/**
 * The building/street-number + street-name segment of a noise-stripped
 * address, e.g. "10 stratton street" out of
 * "the johnson building, 10 stratton street". Returns null when no segment
 * starts with a number — callers must not treat a bare building name as a
 * strong identifier on its own.
 */
function extractStreetKey(noiseStripped: string): string | null {
  const segments = noiseStripped.split(",").map((segment) => segment.trim());
  return segments.find((segment) => LEADING_NUMBER_PATTERN.test(segment)) ?? null;
}

/**
 * True only when two addresses share the same building/street number and
 * street name — not merely the same postcode, a substring relationship, or
 * overlapping words. Harmless formatting differences (case, punctuation,
 * commas, "London", a trailing postcode) are ignored, but a different
 * building/street number is not. When neither address has a leading
 * street number (pure building names), falls back to exact match on the
 * noise-stripped text so unrelated buildings aren't flagged.
 */
export function addressesLookSimilar(a: string, b: string): boolean {
  const coreA = stripAddressNoise(a);
  const coreB = stripAddressNoise(b);
  if (!coreA || !coreB) return false;

  const keyA = extractStreetKey(coreA);
  const keyB = extractStreetKey(coreB);

  if (keyA && keyB) return keyA === keyB;
  if (!keyA && !keyB) return coreA === coreB;
  return false;
}

/**
 * Pure matcher used by findSimilarProperty (and unit tests).
 * Matches only on street address (building/street number + street name).
 * A shared postcode alone is never sufficient — different buildings can
 * legitimately share, or sit right next to, the same postcode.
 */
export function findSimilarPropertyInList(
  candidates: SimilarProperty[],
  options: { address: string; postcode: string; excludeId?: string | null },
): SimilarProperty | null {
  const rows = options.excludeId
    ? candidates.filter((row) => row.id !== options.excludeId)
    : candidates;

  if (rows.length === 0) return null;

  return (
    rows.find((row) => addressesLookSimilar(options.address, row.address)) ??
    null
  );
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
