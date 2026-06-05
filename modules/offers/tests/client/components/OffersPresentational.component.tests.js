import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import OffersPresentational from '@/modules/offers/client/components/OffersPresentational';

describe('<OffersPresentational />', () => {
  it('renders a hosting offer with description and guest count', () => {
    render(
      <OffersPresentational
        isOwnOffer={false}
        isUserPublic={true}
        username="alice"
        offer={{
          status: 'yes',
          description: 'You are welcome to stay.',
          maxGuests: 2,
        }}
      />,
    );

    expect(screen.getByText('Accommodation')).toBeInTheDocument();
    expect(screen.getByText('You are welcome to stay.')).toBeInTheDocument();
    expect(screen.getByText('At most 2 guests.')).toBeInTheDocument();
  });

  it('renders the not-hosting fallback for other members', () => {
    render(
      <OffersPresentational
        isOwnOffer={false}
        isUserPublic={true}
        username="alice"
        offer={{ status: 'no' }}
      />,
    );

    expect(
      screen.getByText('Sorry, user is not hosting currently.'),
    ).toBeInTheDocument();
  });

  it('renders nothing when the user is neither public nor the owner', () => {
    const { container } = render(
      <OffersPresentational
        isOwnOffer={false}
        isUserPublic={false}
        username="alice"
        offer={{ status: 'yes' }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows start-hosting actions for an owner who is not hosting', () => {
    render(
      <OffersPresentational
        isOwnOffer={true}
        isUserPublic={true}
        username="alice"
        offer={{ status: 'no' }}
      />,
    );

    expect(
      screen.getByRole('link', { name: 'Start hosting travellers' }),
    ).toHaveAttribute('href', '/offer/host?status=yes');
    expect(screen.getByRole('link', { name: 'Meet people' })).toHaveAttribute(
      'href',
      '/offer/meet',
    );
  });
});
