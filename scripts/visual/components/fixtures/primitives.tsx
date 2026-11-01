// The primitives as they already exist. Before and after render the same
// component, so these only change when its styles change.
import React from 'react';
import { Alert } from '@trustroots/ui/Alert';
import { Spinner } from '@trustroots/ui/Spinner';

import type { Fixture } from '../fixture.ts';

const same = (fixture: Omit<Fixture, 'after'>): Fixture => ({
  ...fixture,
  after: fixture.before,
});

export const primitiveFixtures: Fixture[] = [
  same({
    id: 'alert',
    width: 360,
    before: text => <Alert>{text.sentence}</Alert>,
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
