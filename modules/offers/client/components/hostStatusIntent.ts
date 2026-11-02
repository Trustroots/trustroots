import type { Intent } from '@trustroots/ui/intent';

/** The button colour for each hosting status. */
export const hostStatusIntent = {
  yes: 'success',
  maybe: 'warning',
  no: 'danger',
} as const satisfies Record<'yes' | 'maybe' | 'no', Intent>;
