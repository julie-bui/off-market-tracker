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

function extractPostcodeFromText(text) {
  const match = text
    .toUpperCase()
    .match(/\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/);
  if (!match) return null;
  return normalizePostcode(`${match[1]}${match[2]}`);
}

function normalizeAddress(value) {
  return normalizeComparable(value).replace(/[^a-z0-9]/g, "");
}

function addressesLookSimilar(a, b) {
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

function findSimilarPropertyInList(candidates, options) {
  const rows = options.excludeId
    ? candidates.filter((row) => row.id !== options.excludeId)
    : candidates;

  if (rows.length === 0) return null;

  const enteredPostcode =
    normalizePostcode(options.postcode) ??
    extractPostcodeFromText(options.address);

  if (enteredPostcode) {
    const byPostcode = rows.find((row) => {
      const rowPostcode =
        normalizePostcode(row.postcode) ?? extractPostcodeFromText(row.address);
      return rowPostcode != null && rowPostcode === enteredPostcode;
    });
    if (byPostcode) return byPostcode;
  }

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
assert.ok(casingMatch, "expected duplicate for case-different postcode");
assert.equal(casingMatch.id, "1");
console.log("✓ case-insensitive postcode duplicate detected:", casingMatch.address);

const liveLike = findSimilarPropertyInList(
  [
    ...existing,
    { id: "3", address: "30 st mary axe", postcode: "ec3a 8bf" },
  ],
  { address: "30 ST MARY AXE", postcode: "Ec3a 8Bf" },
);
assert.ok(liveLike);
console.log("✓ matches existing mixed-case St Mary Axe rows");

assert.equal(specsToPlainText('{"text":"vasfjnvjanv/leR"}'), "vasfjnvjanv/leR");
console.log("✓ specs JSON wrapper unwraps to plain text");
console.log("All checks passed.");
