// Every component fixture. Add a file per component and list it here.
import type { Fixture } from '../fixture.ts';
import { alertFixtures } from './alert.tsx';
import { primitiveFixtures } from './primitives.tsx';

export const fixtures: Fixture[] = [...primitiveFixtures, ...alertFixtures];
