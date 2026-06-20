import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import NavigationLoggedOut from '@/modules/core/client/components/NavigationLoggedOut';

jest.mock('@/modules/core/client/components/LanguageSwitch', () => {
  const React = require('react');

  function MockLanguageSwitch() {
    return <span>language-switch</span>;
  }

  return MockLanguageSwitch;
});

describe('<NavigationLoggedOut />', () => {
  it('renders homepage CTA links for unauthenticated users', () => {
    render(<NavigationLoggedOut currentPath="/" />);

    expect(
      screen.queryByRole('link', { name: 'Read more' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Join' })).toHaveAttribute(
      'href',
      '/signup',
    );
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute(
      'href',
      '/signin',
    );
    expect(screen.getByText('language-switch')).toBeInTheDocument();
  });

  it('shows a read more link when not on the homepage', () => {
    render(<NavigationLoggedOut currentPath="/faq" />);

    expect(screen.getByRole('link', { name: /Read more/ })).toHaveAttribute(
      'href',
      '/',
    );
  });
});
