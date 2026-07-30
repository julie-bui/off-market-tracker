import {
  addMonthsUk,
  formatUkDate,
  getUkParts,
  toUkTimeInputValue,
  zonedUkTimeToUtcIso,
} from "@/lib/uk-time";

/** Fixed retention period for property auto-delete. */
export const AUTO_DELETE_DEFAULT_MONTHS = 3;

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
 * Auto-delete date is always now + 3 months in UK time.
 * Blank time → keep the current UK clock time on that day.
 * Set time → that UK time of day on the UK calendar day of now+3 months.
 */
export function resolveAutoDeleteAt(
  timeInput: string = "",
  from: Date = new Date(),
): string {
  const base = addMonthsUk(from, AUTO_DELETE_DEFAULT_MONTHS);
  const trimmed = timeInput.trim();
  const parts = getUkParts(base);

  if (!trimmed) {
    return zonedUkTimeToUtcIso(
      parts.year,
      parts.month,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
  }

  const { hour, minute } = parseTimeParts(trimmed);
  return zonedUkTimeToUtcIso(
    parts.year,
    parts.month,
    parts.day,
    hour,
    minute,
    0,
  );
}

/** @deprecated Use toUkTimeInputValue — kept for existing imports. */
export function toTimeInputValue(
  value: string | null | undefined,
): string {
  return toUkTimeInputValue(value);
}

export function formatAutoDeleteDateLabel(from: Date = new Date()): string {
  return formatUkDate(addMonthsUk(from, AUTO_DELETE_DEFAULT_MONTHS));
}

export function defaultAutoDeleteHint(): string {
  return `This property will automatically be deleted in ${AUTO_DELETE_DEFAULT_MONTHS} months (on ${formatAutoDeleteDateLabel()}). Times use UK time (GMT/BST). You can set the time of day for that date.`;
}
