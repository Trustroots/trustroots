export const SUPPORT_STATUSES = [
  'new',
  'open',
  'pending',
  'hold',
  'solved',
  'closed',
] as const;

export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  new: 'New',
  open: 'Open',
  pending: 'Pending',
  hold: 'On hold',
  solved: 'Solved',
  closed: 'Closed',
};

export const UNRESOLVED_STATUSES: readonly SupportStatus[] = [
  'new',
  'open',
  'pending',
  'hold',
];

export function isSupportStatus(value: unknown): value is SupportStatus {
  return SUPPORT_STATUSES.includes(value as SupportStatus);
}

/** Preserve the meaning of records and links created before the six-state inbox. */
export function normaliseSupportStatus(value?: string | null): SupportStatus {
  if (value === 'resolved') return 'solved';
  return isSupportStatus(value) ? value : 'open';
}
