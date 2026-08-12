import assert from "node:assert/strict";

function normalizeComparable(value) {
  return (value ?? "").trim().toLowerCase();
}

function normalizePostcode(value) {
  const trimmed = normalizeComparable(value);
  if (!trimmed) return null;
  const compact = trimmed.replace(/\s+/g, "");
  return compact || null;
}

const UK_POSTCODE_PATTERN = /\b[a-z]{1,2}\d[a-z\d]?\s*\d[a-z]{2}\b/i;

function stripAddressNoise(value) {
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

function extractStreetKey(noiseStripped) {
  const segments = noiseStripped.split(",").map((segment) => segment.trim());
  return segments.find((segment) => LEADING_NUMBER_PATTERN.test(segment)) ?? null;
}

function addressesLookSimilar(a, b) {
  const coreA = stripAddressNoise(a);
  const coreB = stripAddressNoise(b);
  if (!coreA || !coreB) return false;

  const keyA = extractStreetKey(coreA);
  const keyB = extractStreetKey(coreB);

  if (keyA && keyB) return keyA === keyB;
  if (!keyA && !keyB) return coreA === coreB;
  return false;
}

function findSimilarPropertyInList(candidates, options) {
  const rows = options.excludeId
    ? candidates.filter((row) => row.id !== options.excludeId)
    : candidates;

  if (rows.length === 0) return null;

  return (
    rows.find((row) => addressesLookSimilar(options.address, row.address)) ??
    null
  );
}

function specsToPlainText(specs) {
  if (specs == null) return "";
  if (typeof specs === "object" && !Array.isArray(specs)) {
    if (typeof specs.text === "string") return specsToPlainText(specs.text);
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

const existing = [
  { id: "1", address: "30 St Mary Axe, London", postcode: "EC3A 8BF" },
  { id: "2", address: "1 Poultry, London", postcode: "EC2R 8EJ" },
];

assert.equal(normalizePostcode("EC3A 8BF"), "ec3a8bf");
assert.equal(normalizePostcode("ec3a 8bf"), "ec3a8bf");

const casingMatch = findSimilarPropertyInList(existing, {
  address: "30 st mary axe, london",
  postcode: "ec3a 8bf",
});
assert.ok(casingMatch, "expected duplicate for same street address, different case");
assert.equal(casingMatch.id, "1");
console.log("✓ case-insensitive address duplicate detected:", casingMatch.address);

const liveLike = findSimilarPropertyInList(
  [
    ...existing,
    { id: "3", address: "30 st mary axe", postcode: "ec3a 8bf" },
  ],
  { address: "30 ST MARY AXE", postcode: "Ec3a 8Bf" },
);
assert.ok(liveLike);
console.log("✓ matches existing mixed-case St Mary Axe rows");

// --- Stricter street-address matching (must match) ---

assert.ok(
  addressesLookSimilar("10 Stratton Street", "10 Stratton Street"),
  "identical addresses must match",
);
assert.ok(
  addressesLookSimilar("10 Stratton Street", "10 STRATTON STREET"),
  "case differences must not prevent a match",
);
assert.ok(
  addressesLookSimilar("10 Stratton Street", "10 Stratton Street, London"),
  "trailing 'London' must not prevent a match",
);
assert.ok(
  addressesLookSimilar(
    "10 Stratton Street",
    "10 Stratton Street, London W1J 8LG",
  ),
  "trailing postcode must not prevent a match",
);
assert.ok(
  addressesLookSimilar(
    "10 Stratton Street",
    "10 Stratton Street, London, W1J 8LG",
  ),
  "comma-separated trailing postcode must not prevent a match",
);
assert.ok(
  addressesLookSimilar(
    "The Johnson Building, 77 Hatton Garden",
    "77 Hatton Garden",
  ),
  "a numbered street address must match through a building-name prefix",
);
console.log("✓ harmless formatting differences (case, punctuation, London, postcode) still match");

// --- Stricter street-address matching (must NOT match) ---

assert.ok(
  !addressesLookSimilar("10 Stratton Street", "11 Stratton Street"),
  "different street numbers on the same street must not match",
);
assert.ok(
  !addressesLookSimilar("11 Brook Street", "12 Brook Street"),
  "different street numbers must not match",
);
assert.ok(
  !addressesLookSimilar("11 Brook Street", "11 Grosvenor Street"),
  "different street names must not match",
);
assert.ok(
  !addressesLookSimilar("5 Oak Street", "9 Pine Street"),
  "addresses that merely share words like 'Street' must not match",
);
console.log("✓ different street numbers/names are never flagged");

// Postcode alone (or same-postcode, different street) must never trigger a match.
const samePostcodeDifferentStreet = findSimilarPropertyInList(
  [{ id: "4", address: "5 Oak Road", postcode: "SW1A 1AA" }],
  { address: "9 Pine Lane", postcode: "SW1A 1AA" },
);
assert.equal(
  samePostcodeDifferentStreet,
  null,
  "same postcode alone must not flag two different street addresses",
);

const brookStreetOtherPostcode = findSimilarPropertyInList(
  [
    { id: "5", address: "20 Brook Street", postcode: "W1K 5DA" },
    { id: "6", address: "1 Some Other Road", postcode: "SW1A 1AA" },
  ],
  { address: "11 Brook Street", postcode: "SW1A 1AA" },
);
assert.equal(
  brookStreetOtherPostcode,
  null,
  "11 Brook Street must not be flagged merely because another Brook Street or same-postcode property exists",
);
console.log("✓ postcode equality alone never triggers the duplicate warning");

assert.equal(specsToPlainText('{"text":"vasfjnvjanv/leR"}'), "vasfjnvjanv/leR");
console.log("✓ specs JSON wrapper unwraps to plain text");
console.log("All checks passed.");
