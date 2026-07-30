/** Default retention when the auto-delete date field is left blank. */
export const AUTO_DELETE_DEFAULT_MONTHS = 3;

/** Add calendar months to a date (local time). */
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

/** End of the given local calendar day as an ISO timestamptz string. */
export function endOfLocalDayIso(date: Date): string {
  const end = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
  return end.toISOString();
}

/**
 * Resolve the auto-delete timestamp from an optional date input value.
 * Blank / whitespace → now + 3 months (end of that day).
 * A valid yyyy-mm-dd → end of that local day.
 */
export function resolveAutoDeleteAt(
  dateInput: string,
  from: Date = new Date(),
): string {
  const trimmed = dateInput.trim();
  if (!trimmed) {
    return endOfLocalDayIso(addMonths(from, AUTO_DELETE_DEFAULT_MONTHS));
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    throw new Error("Auto-delete date must be a valid date.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month ||
    parsed.getDate() !== day
  ) {
    throw new Error("Auto-delete date must be a valid date.");
  }

  return endOfLocalDayIso(parsed);
}

/** Format a timestamptz for an HTML date input (yyyy-mm-dd, local). */
export function toDateInputValue(
  value: string | null | undefined,
): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function defaultAutoDeleteHint(): string {
  return `Leave blank to automatically delete this property in ${AUTO_DELETE_DEFAULT_MONTHS} months. Or set a date to choose when it is removed from the database.`;
}
