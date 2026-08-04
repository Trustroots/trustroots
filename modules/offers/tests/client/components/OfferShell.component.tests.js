import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import OfferShell from '@/modules/offers/client/components/OfferShell.component';

describe('<OfferShell />', () => {
  it('renders children for public members', () => {
    render(
      <OfferShell user={{ public: true, username: 'alice' }}>
        <p>Offer content</p>
      </OfferShell>,
    );

    expect(screen.getByText('Offer content')).toBeInTheDocument();
  });

  it('shows the activation message for non-public members', () => {
    render(
      <OfferShell user={{ public: false, username: 'alice' }}>
        <p>Offer content</p>
      </OfferShell>,
    );

    expect(
      screen.getByText(/activate your profile by confirming your email/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('Offer content')).not.toBeInTheDocument();
  });
});
