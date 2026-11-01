import type { ReactNode } from 'react';

/** Interaction states the shooter can put a fixture's target into. */
export type State = 'rest' | 'hover' | 'focus-visible' | 'active';

export interface FixtureText {
  label: string;
  short: string;
  sentence: string;
}

/**
 * One component example, rendered twice: `before` is the markup the app uses
 * on the base branch (for example raw Bootstrap classes) and is shown with the
 * base branch's stylesheet; `after` is the replacement, shown with the head
 * branch's stylesheet. The harness compares the two pixel for pixel.
 */
export interface Fixture {
  id: string;
  before: (text: FixtureText) => ReactNode;
  after: (text: FixtureText) => ReactNode;
  /** Defaults to `['rest']`. */
  states?: State[];
  /** Element inside the fixture that receives hover, focus and press. */
  target?: string;
  /** Width of the fixture's container in CSS pixels; defaults to content. */
  width?: number;
}
