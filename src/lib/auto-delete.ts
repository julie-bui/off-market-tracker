/** Default retention when the auto-delete date/time fields are left blank. */
export const AUTO_DELETE_DEFAULT_MONTHS = 3;

/** Add calendar months to a date (local time), preserving clock time. */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getDate();
  result.setMonth(result.getMonth() + months);
  // Clamp when the target month has fewer days (e.g. Jan 31 → Feb).
  if (result.getDate() < day) {
    result.setDate(0);
  }
  return result;
}

function parseLocalDateParts(dateInput: string): {
  year: number;
  month: number;
  day: number;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput.trim());
  if (!match) {
    throw new Error("Auto-delete date must be a valid date.");
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const probe = new Date(year, month, day);
  if (
    Number.isNaN(probe.getTime()) ||
    probe.getFullYear() !== year ||
    probe.getMonth() !== month ||
    probe.getDate() !== day
  ) {
    throw new Error("Auto-delete date must be a valid date.");
  }
  return { year, month, day };
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
 * Resolve auto-delete from separate date + time inputs.
 * Both blank → now + 3 months.
 * Date + time set → that local date/time.
 * Only one filled → error asking for both.
 */
export function resolveAutoDeleteAtFromParts(
  dateInput: string,
  timeInput: string,
  from: Date = new Date(),
): string {
  const dateTrimmed = dateInput.trim();
  const timeTrimmed = timeInput.trim();

  if (!dateTrimmed && !timeTrimmed) {
    return addMonths(from, AUTO_DELETE_DEFAULT_MONTHS).toISOString();
  }

  if (!dateTrimmed || !timeTrimmed) {
    throw new Error(
      "Set both an auto-delete date and time, or leave both blank for 3 months.",
    );
  }

  const { year, month, day } = parseLocalDateParts(dateTrimmed);
  const { hour, minute } = parseLocalTimeParts(timeTrimmed);
  const parsed = new Date(year, month, day, hour, minute, 0, 0);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Auto-delete must be a valid date and time.");
  }
  return parsed.toISOString();
}

/** Split a timestamptz into local date (yyyy-mm-dd) and time (HH:mm). */
export function toAutoDeleteInputParts(
  value: string | null | undefined,
): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "", time: "" };
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`,
  };
}

export function defaultAutoDeleteHint(): string {
  return `Leave date and time blank to automatically delete this property in ${AUTO_DELETE_DEFAULT_MONTHS} months. Or set both a date and a time to choose when it is removed from the database.`;
}
