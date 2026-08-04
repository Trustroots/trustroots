import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
import ConfirmEmailInvalidPage from '@/modules/users/client/components/ConfirmEmailInvalidPage.component';

function renderPage(user) {
  return render(
    <AppProviders
      bootstrapData={{
        env: 'test',
        isNativeMobileApp: false,
        settings: {},
        title: 'Trustroots',
        user,
      }}
    >
      <ConfirmEmailInvalidPage />
    </AppProviders>,
  );
}

describe('ConfirmEmailInvalidPage', () => {
  it('shows the invalid token message for guests', () => {
    renderPage(null);

    expect(
      screen.getByText('Email confirm token is invalid or has expired.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /login first/i })).toHaveAttribute(
      'href',
      '/signin',
    );
  });

  it('shows the current email and settings link for signed-in members', () => {
    renderPage({ _id: 'user-1', email: 'ada@example.com' });

    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /your settings/i }),
    ).toHaveAttribute('href', '/profile/edit/account');
  });
});
