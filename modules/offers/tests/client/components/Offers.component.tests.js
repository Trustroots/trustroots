import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import { Offers } from '@/modules/offers/client/components/Offers.component';
import { getOffers } from '@/modules/offers/client/api/offers.api';

jest.mock('@/modules/offers/client/api/offers.api', () => ({
  getOffers: jest.fn(),
}));

jest.mock('@/modules/offers/client/components/OffersPresentational', () => {
  const React = require('react');
  const PropTypes = require('prop-types');
  function MockOffersPresentational({
    isOwnOffer,
    isUserPublic,
    offer,
    username,
  }) {
    return (
      <div>
        <div>{`own:${isOwnOffer}`}</div>
        <div>{`public:${isUserPublic}`}</div>
        <div>{`status:${offer.status || 'loading'}`}</div>
        <div>{`username:${username}`}</div>
      </div>
    );
  }
  MockOffersPresentational.propTypes = {
    isOwnOffer: PropTypes.bool.isRequired,
    isUserPublic: PropTypes.bool,
    offer: PropTypes.object.isRequired,
    username: PropTypes.string.isRequired,
  };
  return MockOffersPresentational;
});

describe('<Offers />', () => {
  beforeEach(() => {
    getOffers.mockReset();
  });

  it('loads host offers and marks the authenticated owner', async () => {
    getOffers.mockResolvedValue([{ status: 'yes' }]);

    render(
      <Offers
        authUser={{ _id: 'user-1', public: true }}
        profile={{ _id: 'user-1', username: 'alice' }}
      />,
    );

    await waitFor(() =>
      expect(getOffers).toHaveBeenCalledWith('user-1', 'host'),
    );

    expect(screen.getByText('own:true')).toBeInTheDocument();
    expect(screen.getByText('public:true')).toBeInTheDocument();
    expect(screen.getByText('status:yes')).toBeInTheDocument();
    expect(screen.getByText('username:alice')).toBeInTheDocument();
  });

  it('falls back to not-hosting when the profile has no host offers', async () => {
    getOffers.mockResolvedValue([]);

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
    expect(screen.getByText('status:loading')).toBeInTheDocument();
  });
});
