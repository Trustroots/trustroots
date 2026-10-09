import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import NavigationLoggedOut from '@/modules/core/client/components/NavigationLoggedOut';
import type LanguageSwitch from '@/modules/core/client/components/LanguageSwitch';

jest.mock('@/modules/core/client/components/LanguageSwitch', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockLanguageSwitch(
    _props: React.ComponentProps<typeof LanguageSwitch>,
  ) {
    void _props;
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
