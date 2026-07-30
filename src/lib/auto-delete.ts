import {
  addMonthsUk,
  formatUkDate,
  getUkParts,
  toUkTimeInputValue,
  zonedUkTimeToUtcIso,
} from "@/lib/uk-time";

/** Suggested default when enabling auto-delete. */
export const AUTO_DELETE_DEFAULT_MONTHS = 3;

function parseDateParts(dateInput: string): {
  year: number;
  month: number;
  day: number;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput.trim());
  if (!match) {
    throw new Error("Auto-delete date must be a valid date.");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    throw new Error("Auto-delete date must be a valid date.");
  }
  return { year, month, day };
}

function parseTimeParts(timeInput: string): {
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
 * Resolve auto-delete from optional schedule.
 * enabled=false → null (keep forever).
 * enabled=true → UK date + time (time blank uses current UK clock time).
 */
export function resolveAutoDeleteAt(options: {
  enabled: boolean;
  dateInput: string;
  timeInput: string;
  from?: Date;
}): string | null {
  if (!options.enabled) return null;

  const from = options.from ?? new Date();
  const dateTrimmed = options.dateInput.trim();
  if (!dateTrimmed) {
    throw new Error("Choose an auto-delete date, or turn auto-delete off to keep this property.");
  }

  const { year, month, day } = parseDateParts(dateTrimmed);
  const timeTrimmed = options.timeInput.trim();
  const nowParts = getUkParts(from);

  if (!timeTrimmed) {
    return zonedUkTimeToUtcIso(
      year,
      month,
      day,
      nowParts.hour,
      nowParts.minute,
      nowParts.second,
    );
  }

  const { hour, minute } = parseTimeParts(timeTrimmed);
  return zonedUkTimeToUtcIso(year, month, day, hour, minute, 0);
}

/** yyyy-mm-dd in UK time for an HTML date input. */
export function toDateInputValue(
  value: string | null | undefined,
): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = getUkParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/** @deprecated Use toUkTimeInputValue — kept for existing imports. */
export function toTimeInputValue(
  value: string | null | undefined,
): string {
  return toUkTimeInputValue(value);
}

/** Default UK date (+3 months) for new schedules. */
export function defaultAutoDeleteDateInput(from: Date = new Date()): string {
  return toDateInputValue(addMonthsUk(from, AUTO_DELETE_DEFAULT_MONTHS).toISOString());
}

export function formatAutoDeleteDateLabel(from: Date = new Date()): string {
  return formatUkDate(addMonthsUk(from, AUTO_DELETE_DEFAULT_MONTHS));
}

export function defaultAutoDeleteHint(): string {
  return `Turn auto-delete on to remove this property on a date and time you choose (UK time, GMT/BST). Turn it off to keep the property. Suggested date: ${formatAutoDeleteDateLabel()}.`;
}
