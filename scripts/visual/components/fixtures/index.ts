// Every component fixture. Add a file per component and list it here.
import type { Fixture } from '../fixture.ts';
import { badgeFixtures } from './badges.tsx';
import { labelFixtures } from './labels.tsx';
import { primitiveFixtures } from './primitives.tsx';

export const fixtures: Fixture[] = [
  ...primitiveFixtures,
  ...badgeFixtures,
  ...labelFixtures,
];
