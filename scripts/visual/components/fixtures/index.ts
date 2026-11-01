// Every component fixture. Add a file per component and list it here.
import type { Fixture } from '../fixture.ts';
import { buttonFixtures } from './button.tsx';
import { primitiveFixtures } from './primitives.tsx';

export const fixtures: Fixture[] = [...primitiveFixtures, ...buttonFixtures];
