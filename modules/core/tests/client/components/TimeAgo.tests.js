import '@testing-library/jest-dom/extend-expect';
import { render, act } from '@testing-library/react';
import fakeTimers from '@sinonjs/fake-timers';
import React from 'react';

import TimeAgo from '@/modules/core/client/components/TimeAgo';

// @TODO: timer can be migrated to Jest
// https://github.com/facebook/jest/issues/5165
// https://jestjs.io/docs/en/jest-object#jestusefaketimersimplementation-modern--legacy
let clock;
beforeEach(() => (clock = fakeTimers.install()));
afterEach(() => clock.uninstall());

describe('<TimeAgo>', () => {
  it('start with a few seconds ago', async () => {
    const { container } = render(<TimeAgo date={new Date()} />);
    expect(container).toHaveTextContent('a few seconds ago');
  });

  it('updates over time', () => {
    const { container } = render(<TimeAgo date={new Date()} />);
    act(() => {
      clock.tick('00:34:10');
    });
    expect(container).toHaveTextContent('34 minutes ago');
  });
});
