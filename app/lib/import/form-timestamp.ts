/** Timezone the form's Timestamp column is written in — the form owner's Google
 *  setting, not the viewer's. Wrong value here skews `submittedAt` by hours. */
const FORM_TIME_ZONE = "America/Los_Angeles";

/** Offset in milliseconds between UTC and `timeZone` at a given instant. */
function zoneOffset(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const field = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    field("year"),
    field("month") - 1,
    field("day"),
    field("hour"),
    field("minute"),
    field("second"),
  );

  return asUtc - instant;
}

/**
 * Turns the sheet's `8/11/2026 11:45:20` into an ISO instant.
 *
 * The column is a wall clock in the form's timezone with no offset written down,
 * so `new Date(value)` would read it as the server's local time — which in
 * production is UTC, putting every submission seven hours early and reordering
 * the grading queue around midnight.
 *
 * Corrects the naive UTC reading by the zone's offset at that moment. During the
 * hour repeated when clocks go back, a wall clock genuinely names two instants
 * and this picks one; an hour of ambiguity once a year only affects display and
 * ordering, so it is not worth a timezone library.
 */
export function parseFormTimestamp(value: string) {
  const match = value
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;

  const [, month, day, year, hour, minute, second] = match;
  const naive = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? "0"),
  );

  const corrected = naive - zoneOffset(naive, FORM_TIME_ZONE);
  return Number.isNaN(corrected) ? null : new Date(corrected).toISOString();
}
