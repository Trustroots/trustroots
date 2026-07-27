import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import { useCurrentPath } from '@/modules/core/client/react-app/useCurrentPath';

function PathConsumer() {
  const currentPath = useCurrentPath();

  return <span>{currentPath}</span>;
}

describe('useCurrentPath', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('updates when the browser history changes', () => {
    window.history.pushState({}, '', '/rules');
    render(<PathConsumer />);

    expect(screen.getByText('/rules')).toBeInTheDocument();

    act(() => {
      window.history.pushState({}, '', '/faq');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(screen.getByText('/faq')).toBeInTheDocument();
  });
});
