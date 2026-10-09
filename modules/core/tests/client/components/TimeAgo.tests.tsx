import '@testing-library/jest-dom';
import { render, act } from '@testing-library/react';
import React from 'react';

import TimeAgo from '@/modules/core/client/components/TimeAgo';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('<TimeAgo>', () => {
  it('start with a few seconds ago', async () => {
    const { container } = render(<TimeAgo date={new Date()} />);
    expect(container).toHaveTextContent('a few seconds ago');
  });

  it('updates over time', () => {
    const { container } = render(<TimeAgo date={new Date()} />);
    act(() => {
      jest.advanceTimersByTime(34 * 60 * 1000);
    });
    expect(container).toHaveTextContent('34 minutes ago');
  });
});
