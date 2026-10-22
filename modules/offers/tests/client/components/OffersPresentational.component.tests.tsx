import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import OffersPresentational from '@/modules/offers/client/components/OffersPresentational';
import type { Offer } from '@/modules/offers/client/api/offers.api';
import type OfferLocation from '@/modules/offers/client/components/OfferLocation.component';

jest.mock('@/modules/offers/client/components/OfferLocation.component', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return function MockOfferLocation({
    location,
    height,
    offerStatus,
    offerType,
  }: React.ComponentProps<typeof OfferLocation>) {
    return location ? (
      <div
        data-testid="hosting-map"
        data-location={JSON.stringify(location)}
        data-height={height}
        data-status={offerStatus}
        data-type={offerType}
      />
    ) : null;
  };
});

const hostingOffer: Offer = {
  status: 'yes',
  description: 'You are welcome to stay.',
  maxGuests: 2,
};

describe('<OffersPresentational />', () => {
  it('shows meeting availability beside the unavailable hosting state', () => {
    render(
      <OffersPresentational
        isOwnOffer={false}
        isUserPublic={true}
        offer={{ status: 'no', happyToMeet: true }}
      />,
    );
    expect(screen.getByText('Happy to meet')).toBeVisible();
    expect(screen.getByText('Cannot host currently')).toBeVisible();
    expect(screen.queryByText('Can host')).not.toBeInTheDocument();
  });

  it('links the owner directly to the location editor', () => {
    render(
      <OffersPresentational
        isOwnOffer={true}
        isUserPublic={true}
        offer={{ ...hostingOffer, location: [51, 4] }}
      />,
    );
    expect(screen.getByText('Approximate hosting location')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Edit location' })).toHaveAttribute(
      'href',
      '/offer/host#location',
    );
  });
  it.each(['yes', 'maybe'] as const)(
    'shows a compact map for status %s',
    status => {
      render(
        <OffersPresentational
          isOwnOffer={false}
          isUserPublic={true}
          offer={{ ...hostingOffer, status, location: [51, 4] }}
        />,
      );
      const map = screen.getByTestId('hosting-map');
      expect(map).toHaveAttribute('data-location', '[51,4]');
      expect(map).toHaveAttribute('data-height', '220');
      expect(map).toHaveAttribute('data-status', status);
      expect(map).toHaveAttribute('data-type', 'host');
    },
  );

  it('omits the map when the member is not hosting', () => {
    render(
      <OffersPresentational
        isOwnOffer={false}
        isUserPublic={true}
        offer={{ status: 'no', location: [51, 4] }}
      />,
    );
    expect(screen.queryByTestId('hosting-map')).not.toBeInTheDocument();
  });
  it('renders a hosting offer with description and guest count', () => {
    render(
      <OffersPresentational
        isOwnOffer={false}
        isUserPublic={true}
        username="alice"
        offer={hostingOffer}
      />,
    );

    expect(screen.getByText('Accommodation')).toBeInTheDocument();
    expect(screen.getByText('You are welcome to stay.')).toBeInTheDocument();
    expect(screen.getByText('At most 2 guests.')).toBeInTheDocument();
  });

  it('uses empty content and zero guests when optional hosting details are absent', () => {
    render(
      <OffersPresentational
        isOwnOffer={false}
        isUserPublic={true}
        username="alice"
        offer={{ status: 'yes' }}
      />,
    );

    expect(screen.getByText('No guests.')).toBeInTheDocument();
    expect(screen.getByText('Accommodation')).toBeInTheDocument();
  });

  it('renders owner edit action and no-guest copy for an active hosting offer', () => {
    render(
      <OffersPresentational
        isOwnOffer={true}
        isUserPublic={true}
        username="alice"
        offer={{
          status: 'maybe',
          description: 'I can host if dates work.',
          maxGuests: 0,
        }}
      />,
    );

    expect(
      screen.getByRole('link', { name: 'Modify hosting offer' }),
    ).toHaveAttribute('href', '/offer/host');
    expect(screen.getByText('No guests.')).toBeInTheDocument();
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

  it('renders a custom not-hosting explanation when one exists', () => {
    render(
      <OffersPresentational
        isOwnOffer={false}
        isUserPublic={true}
        username="alice"
        offer={{
          status: 'no',
          noOfferDescription: 'I am travelling this month.',
        }}
      />,
    );

    expect(screen.getByText('I am travelling this month.')).toBeInTheDocument();
    expect(
      screen.queryByText('Sorry, user is not hosting currently.'),
    ).not.toBeInTheDocument();
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
