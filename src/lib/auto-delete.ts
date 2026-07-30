/** Fixed retention period for property auto-delete. */
export const AUTO_DELETE_DEFAULT_MONTHS = 3;

/** Add calendar months in UTC, preserving the UTC clock time. */
export function addMonthsUtc(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCMonth(result.getUTCMonth() + months);
  // Clamp when the target month has fewer days (e.g. Jan 31 → Feb).
  if (result.getUTCDate() < day) {
    result.setUTCDate(0);
  }
  return result;
}

/** Add calendar months in local time, preserving local clock time. */
export function addMonthsLocal(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getDate();
  result.setMonth(result.getMonth() + months);
  if (result.getDate() < day) {
    result.setDate(0);
  }
  return result;
}

function parseLocalTimeParts(timeInput: string): {
  hour: number;
  minute: number;
} {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(timeInput.trim());
  if (!match) {
    throw new Error("Auto-delete time must be a valid time.");
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error("Auto-delete time must be a valid time.");
  }
  return { hour, minute };
}

/**
 * Auto-delete date is always now + 3 months.
 * Blank time → same UTC clock as "now" (+3 months), so it matches Created time of day.
 * Set time → that local time of day on the local calendar day of now+3 months.
 */
export function resolveAutoDeleteAt(
  timeInput: string = "",
  from: Date = new Date(),
): string {
  const trimmed = timeInput.trim();

  if (!trimmed) {
    return addMonthsUtc(from, AUTO_DELETE_DEFAULT_MONTHS).toISOString();
  }

  const base = addMonthsLocal(from, AUTO_DELETE_DEFAULT_MONTHS);
  const { hour, minute } = parseLocalTimeParts(trimmed);
  const withTime = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    hour,
    minute,
    0,
    0,
  );
  if (Number.isNaN(withTime.getTime())) {
    throw new Error("Auto-delete time must be a valid time.");
  }
  return withTime.toISOString();
}

/** Format a timestamptz for an HTML time input (HH:mm, local). */
export function toTimeInputValue(
  value: string | null | undefined,
): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

/** Local calendar date label for the fixed 3-month auto-delete day. */
export function formatAutoDeleteDateLabel(from: Date = new Date()): string {
  const date = addMonthsLocal(from, AUTO_DELETE_DEFAULT_MONTHS);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function defaultAutoDeleteHint(): string {
  return `This property will automatically be deleted in ${AUTO_DELETE_DEFAULT_MONTHS} months (on ${formatAutoDeleteDateLabel()}). You can set the time of day for that date.`;
}
