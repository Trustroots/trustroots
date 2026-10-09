import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { Offers } from '@/modules/offers/client/components/Offers.component';
import { getOffers, type Offer } from '@/modules/offers/client/api/offers.api';

const getOffersMock = jest.mocked(getOffers);

type MockOffersPresentationalProps = {
  isOwnOffer: boolean;
  isUserPublic?: boolean;
  offer: Offer;
  username?: string;
};

jest.mock('@/modules/offers/client/api/offers.api', () => ({
  getOffers: jest.fn(),
}));

jest.mock('@/modules/offers/client/components/OffersPresentational', () => {
  function MockOffersPresentational({
    isOwnOffer,
    isUserPublic,
    offer,
    username,
  }: MockOffersPresentationalProps) {
    return (
      <div>
        <div>{`own:${isOwnOffer}`}</div>
        <div>{`public:${isUserPublic}`}</div>
        <div>{`status:${offer.status || 'loading'}`}</div>
        <div>{`username:${username || 'none'}`}</div>
      </div>
    );
  }
  return MockOffersPresentational;
});

describe('<Offers />', () => {
  beforeEach(() => {
    getOffersMock.mockReset();
    window.isNativeMobileApp = false;
  });

  afterEach(() => {
    window.isNativeMobileApp = false;
    jest.restoreAllMocks();
  });

  it('loads host offers and marks the authenticated owner', async () => {
    getOffersMock.mockResolvedValue([{ status: 'yes' }]);

    render(
      <Offers
        authUser={{ _id: 'user-1', public: true }}
        profile={{ _id: 'user-1', username: 'alice' }}
      />,
    );

    expect(await screen.findByText('status:yes')).toBeInTheDocument();
    expect(getOffers).toHaveBeenCalledWith('user-1', 'host');

    expect(screen.getByText('own:true')).toBeInTheDocument();
    expect(screen.getByText('public:true')).toBeInTheDocument();
    expect(screen.getByText('username:alice')).toBeInTheDocument();
  });

  it('does not present a not-hosting status while an offer is loading', async () => {
    let resolveOffers!: (offers: Offer[]) => void;
    getOffersMock.mockReturnValue(
      new Promise<Offer[]>(resolve => {
        resolveOffers = resolve;
      }),
    );
    render(
      <Offers
        authUser={{ _id: 'viewer', public: true }}
        profile={{ _id: 'host-member', username: 'forest-host' }}
      />,
    );
    expect(screen.queryByText(/status:/)).not.toBeInTheDocument();
    await act(async () => resolveOffers([{ status: 'yes' }]));
    expect(await screen.findByText('status:yes')).toBeInTheDocument();
  });

  it('falls back to not-hosting when the profile has no host offers', async () => {
    getOffersMock.mockResolvedValue([]);

    render(
      <Offers
        authUser={{ _id: 'visitor', public: false }}
        profile={{ _id: 'user-1', username: 'alice' }}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('status:no')).toBeInTheDocument(),
    );
    expect(screen.getByText('own:false')).toBeInTheDocument();
    expect(screen.getByText('public:false')).toBeInTheDocument();
  });

  it('does not fetch offers when profile has no id', () => {
    render(
      <Offers
        authUser={{ _id: 'visitor', public: true }}
        profile={{ username: 'alice' }}
      />,
    );

    expect(getOffers).not.toHaveBeenCalled();
    expect(screen.queryByText('status:loading')).not.toBeInTheDocument();
  });

  it('handles a missing profile without fetching offers', async () => {
    render(<Offers authUser={{ _id: 'visitor', public: true }} />);

    await waitFor(() => expect(getOffers).not.toHaveBeenCalled());

    expect(screen.queryByText('status:loading')).not.toBeInTheDocument();
    expect(screen.queryByText('username:none')).not.toBeInTheDocument();
  });

  it('treats missing authenticated user data as a public false visitor', async () => {
    getOffersMock.mockResolvedValue([{ status: 'maybe' }]);

    render(<Offers profile={{ _id: 'user-1', username: 'alice' }} />);

    expect(await screen.findByText('status:maybe')).toBeInTheDocument();
    expect(getOffers).toHaveBeenCalledWith('user-1', 'host');

    expect(screen.getByText('own:false')).toBeInTheDocument();
    expect(screen.getByText('public:false')).toBeInTheDocument();
  });

  it('detects native mobile app environments during construction', () => {
    window.isNativeMobileApp = true;

    const offers = new Offers({
      authUser: {},
      profile: { username: 'alice' },
    });

    expect(offers.state.isMobile).toBe(true);
  });

  it('detects mobile user agents during construction', () => {
    jest
      .spyOn(window.navigator, 'userAgent', 'get')
      .mockReturnValue('Mozilla/5.0 Mobile Safari');

    const offers = new Offers({
      authUser: {},
      profile: { username: 'alice' },
    });

    expect(offers.state.isMobile).toBe(true);
  });
});
