import React from 'react';
import { act } from 'react-dom/test-utils';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import AppHeader from '@/modules/core/client/components/AppHeader.component';

jest.mock('@/modules/core/client/components/NavigationLoggedIn', () => {
  const React = require('react');

  function MockNavigationLoggedIn({ currentPath, user }) {
    return (
      <div data-testid="logged-in-navigation">
        {currentPath} {user.username}
      </div>
    );
  }

  MockNavigationLoggedIn.propTypes = {
    currentPath: () => null,
    user: () => null,
  };

  return MockNavigationLoggedIn;
});

jest.mock('@/modules/core/client/components/NavigationLoggedOut', () => {
  const React = require('react');

  function MockNavigationLoggedOut({ currentPath }) {
    return <div data-testid="logged-out-navigation">{currentPath}</div>;
  }

  MockNavigationLoggedOut.propTypes = {
    currentPath: () => null,
  };

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
});
