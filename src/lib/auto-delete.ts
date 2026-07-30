/** Default retention when the auto-delete date/time field is left blank. */
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

/**
 * Resolve the auto-delete timestamp from an optional datetime-local value.
 * Blank / whitespace → now + 3 months (same clock time).
 * A valid yyyy-mm-ddTHH:mm (optional seconds) → that local date/time.
 * A valid yyyy-mm-dd alone → that local date at 00:00.
 */
export function resolveAutoDeleteAt(
  dateTimeInput: string,
  from: Date = new Date(),
): string {
  const trimmed = dateTimeInput.trim();
  if (!trimmed) {
    return addMonths(from, AUTO_DELETE_DEFAULT_MONTHS).toISOString();
  }

  const match =
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(
      trimmed,
    );
  if (!match) {
    throw new Error("Auto-delete must be a valid date and time.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = match[4] != null ? Number(match[4]) : 0;
  const minute = match[5] != null ? Number(match[5]) : 0;
  const second = match[6] != null ? Number(match[6]) : 0;

  const parsed = new Date(year, month, day, hour, minute, second, 0);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute ||
    parsed.getSeconds() !== second
  ) {
    throw new Error("Auto-delete must be a valid date and time.");
  }

  return parsed.toISOString();
}

/** Format a timestamptz for an HTML datetime-local input (local). */
export function toDateTimeLocalInputValue(
  value: string | null | undefined,
): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/** @deprecated Use toDateTimeLocalInputValue */
export function toDateInputValue(
  value: string | null | undefined,
): string {
  return toDateTimeLocalInputValue(value);
}

export function defaultAutoDeleteHint(): string {
  return `Leave blank to automatically delete this property in ${AUTO_DELETE_DEFAULT_MONTHS} months. Or set a date and time to choose when it is removed from the database.`;
}
