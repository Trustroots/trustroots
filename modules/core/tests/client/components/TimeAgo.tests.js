import React from 'react';
import { render, act } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

// lolex functionality should/might/may be included in jest one day
// https://github.com/facebook/jest/issues/5165
import lolex from 'lolex';

import TimeAgo from '@/modules/core/client/components/TimeAgo';

let clock;
beforeEach(() => (clock = lolex.install()));
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
