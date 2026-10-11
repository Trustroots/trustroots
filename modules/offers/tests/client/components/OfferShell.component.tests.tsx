import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import OfferShell from '@/modules/offers/client/components/OfferShell.component';

const publicUser: NonNullable<React.ComponentProps<typeof OfferShell>['user']> =
  {
    public: true,
  };
const privateUser: NonNullable<
  React.ComponentProps<typeof OfferShell>['user']
> = {
  public: false,
};

describe('<OfferShell />', () => {
  it('renders children for public members', () => {
    render(
      <OfferShell user={publicUser}>
        <p>Offer content</p>
      </OfferShell>,
    );

    expect(screen.getByText('Offer content')).toBeInTheDocument();
  });

  it('shows the activation message for non-public members', () => {
    render(
      <OfferShell user={privateUser}>
        <p>Offer content</p>
      </OfferShell>,
    );

    expect(
      screen.getByText(/activate your profile by confirming your email/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('Offer content')).not.toBeInTheDocument();
  });
});
