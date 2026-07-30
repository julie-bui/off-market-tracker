/** UK civil time — GMT in winter, BST in summer. */
export const UK_TIME_ZONE = "Europe/London";

type UkParts = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function partsInUk(date: Date): UkParts {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const bag = Object.fromEntries(
    fmt.formatToParts(date).map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}

/**
 * Build an absolute Instant for a wall-clock date/time in Europe/London.
 * Tries UTC±0 and UTC±1 offsets (GMT/BST) and picks the match.
 */
export function zonedUkTimeToUtcIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const wall = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}`;

  for (const offset of ["+01:00", "+00:00"] as const) {
    const candidate = new Date(`${wall}${offset}`);
    if (Number.isNaN(candidate.getTime())) continue;
    const parts = partsInUk(candidate);
    if (
      parts.year === year &&
      parts.month === month &&
      parts.day === day &&
      parts.hour === hour &&
      parts.minute === minute &&
      parts.second === second
    ) {
      return candidate.toISOString();
    }
  }

  // Fallback: treat as UTC (should be rare).
  return new Date(`${wall}Z`).toISOString();
}

/** Add calendar months using UK (Europe/London) wall-clock date. */
export function addMonthsUk(date: Date, months: number): Date {
  const parts = partsInUk(date);
  const utcProbe = new Date(Date.UTC(parts.year, parts.month - 1 + months, 1));
  const year = utcProbe.getUTCFullYear();
  const month = utcProbe.getUTCMonth() + 1; // 1-12
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(parts.day, daysInMonth);
  return new Date(
    zonedUkTimeToUtcIso(year, month, day, parts.hour, parts.minute, parts.second),
  );
}

export function formatUkDateTime(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
    timeZoneName: "short",
  }).format(date);
}

export function formatUkDate(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** HH:mm in UK time for an HTML time input. */
export function toUkTimeInputValue(
  value: string | null | undefined,
): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = partsInUk(date);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function getUkParts(date: Date = new Date()): UkParts {
  return partsInUk(date);
}
