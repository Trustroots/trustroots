import React from 'react';
import { act } from 'react-dom/test-utils';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import AppHeader from '@/modules/core/client/components/AppHeader.component';
import type NavigationLoggedIn from '@/modules/core/client/components/NavigationLoggedIn';
import type NavigationLoggedOut from '@/modules/core/client/components/NavigationLoggedOut';

type LoggedInProps = React.ComponentProps<typeof NavigationLoggedIn>;
type LoggedOutProps = React.ComponentProps<typeof NavigationLoggedOut>;

jest.mock('@/modules/core/client/components/NavigationLoggedIn', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockNavigationLoggedIn({ currentPath, user }: LoggedInProps) {
    return (
      <div data-testid="logged-in-navigation">
        {currentPath} {user.username}
      </div>
    );
  }

  return MockNavigationLoggedIn;
});

jest.mock('@/modules/core/client/components/NavigationLoggedOut', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockNavigationLoggedOut({ currentPath }: LoggedOutProps) {
    return <div data-testid="logged-out-navigation">{currentPath}</div>;
  }

  return MockNavigationLoggedOut;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('<AppHeader />', () => {
  it('renders logged-out navigation with the current path', () => {
    window.history.pushState({}, '', '/signup');

    render(<AppHeader onSignout={jest.fn()} />);

    expect(screen.getByText('Skip to main content')).toHaveAttribute(
      'href',
      '#tr-main',
    );
    expect(screen.getByTestId('logged-out-navigation')).toHaveTextContent(
      '/signup',
    );
  });

  it('renders logged-in navigation and reacts to browser route changes', () => {
    window.history.pushState({}, '', '/profile/alice');

    render(
      <AppHeader
        onSignout={jest.fn()}
        user={{
          _id: 'user-1',
          displayName: 'Alice Example',
          username: 'alice',
        }}
      />,
    );

    expect(screen.getByTestId('logged-in-navigation')).toHaveTextContent(
      '/profile/alice alice',
    );

    window.history.pushState({}, '', '/messages');
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(screen.getByTestId('logged-in-navigation')).toHaveTextContent(
      '/messages alice',
    );
  });

  it('updates menu state from the React route without waiting for popstate', () => {
    const user = {
      _id: 'user-1',
      displayName: 'Alice Example',
      username: 'alice',
    };
    const onSignout = jest.fn();
    const { rerender } = render(
      <AppHeader
        currentPath="/profile/alice"
        onSignout={onSignout}
        user={user}
      />,
    );

    rerender(
      <AppHeader currentPath="/messages" onSignout={onSignout} user={user} />,
    );

    expect(screen.getByTestId('logged-in-navigation')).toHaveTextContent(
      '/messages alice',
    );
  });

  it('tracks the rendered header height as navigation changes size', () => {
    let resizeHeader!: ResizeObserverCallback;
    const originalResizeObserver = global.ResizeObserver;
    const bounds = jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue(DOMRect.fromRect({ height: 54 }));
    global.ResizeObserver = class implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeHeader = callback;
      }
      observe(target: Element) {
        void target;
      }
      unobserve(target: Element) {
        void target;
      }
      disconnect() {}
    };

    try {
      const { unmount } = render(<AppHeader onSignout={jest.fn()} />);
      expect(
        document.documentElement.style.getPropertyValue('--tr-header-height'),
      ).toBe('54px');

      bounds.mockReturnValue(DOMRect.fromRect({ height: 68 }));
      const onResize = resizeHeader;
      const mockObserver = new global.ResizeObserver(() => {});
      act(() => onResize([], mockObserver));
      expect(
        document.documentElement.style.getPropertyValue('--tr-header-height'),
      ).toBe('68px');

      unmount();
      expect(
        document.documentElement.style.getPropertyValue('--tr-header-height'),
      ).toBe('');
    } finally {
      bounds.mockRestore();
      global.ResizeObserver = originalResizeObserver;
    }
  });
});
