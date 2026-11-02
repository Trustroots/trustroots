/** The colour roles every component shares. */
export const intents = [
  'primary',
  'neutral',
  'success',
  'warning',
  'danger',
  'info',
  'inverse',
] as const;

export type Intent = (typeof intents)[number];

/*
 * Each intent sets two custom properties that variants read: `--intent`, the
 * colour itself, and `--on-intent`, text on a solid fill of it.
 */
export const intentClassNames: Record<Intent, string> = {
  primary: 'tw:[--intent:var(--tr-brand-primary)] tw:[--on-intent:white]',
  neutral: 'tw:[--intent:var(--tr-neutral)] tw:[--on-intent:white]',
  success: 'tw:[--intent:var(--tr-success)] tw:[--on-intent:white]',
  warning: 'tw:[--intent:var(--tr-warning)] tw:[--on-intent:white]',
  danger: 'tw:[--intent:var(--tr-danger)] tw:[--on-intent:white]',
  info: 'tw:[--intent:var(--tr-info)] tw:[--on-intent:white]',
  inverse: 'tw:[--intent:white] tw:[--on-intent:var(--tr-brand-primary)]',
};
