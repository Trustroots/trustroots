// The primitives as they already exist. Before and after render the same
// component, so these only change when its styles change.
import React from 'react';
import { Badge } from '@trustroots/ui/Badge';
import { Spinner } from '@trustroots/ui/Spinner';

import type { Fixture } from '../fixture.ts';

const same = (fixture: Omit<Fixture, 'after'>): Fixture => ({
  ...fixture,
  after: fixture.before,
});

export const primitiveFixtures: Fixture[] = [
  same({
    id: 'badge',
    before: text => (
      <span>
        {text.label} <Badge>{text.short}</Badge>
      </span>
    ),
  }),
  same({
    id: 'badge-heading',
    before: text => (
      <h3 style={{ margin: 0 }}>
        {text.label} <Badge>{text.short}</Badge>
      </h3>
    ),
  }),
  same({
    id: 'spinner',
    before: text => (
      <span>
        <Spinner label="Loading" /> {text.label}
      </span>
    ),
  }),
];
