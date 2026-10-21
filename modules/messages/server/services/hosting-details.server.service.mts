import type { HostingDetails } from '../../shared/messages.js';

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

/** Validate the optional request boundary and copy only public visit fields. */
export function parseHostingDetails(
  value: unknown,
): HostingDetails | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid hosting details.');
  }
  const { guests, arrival, departure } = value as {
    guests: number;
    arrival?: unknown;
    departure?: unknown;
  };
  if (!Number.isInteger(guests) || guests < 1 || guests > 100) {
    throw new Error('Guest count must be a whole number from 1 to 100.');
  }
  if (arrival === undefined && departure === undefined) return { guests };
  if (
    !isCalendarDate(arrival) ||
    !isCalendarDate(departure) ||
    departure <= arrival
  ) {
    throw new Error(
      'Choose valid arrival and departure dates, with departure after arrival.',
    );
  }
  return { guests, arrival, departure };
}
