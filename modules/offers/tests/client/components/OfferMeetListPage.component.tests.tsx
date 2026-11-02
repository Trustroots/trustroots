import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import OfferMeetListPage from '@/modules/offers/client/components/OfferMeetListPage.component';
import { fakeAnalytics } from '@/testutils/client/analytics.testutil';
import * as offersApi from '@/modules/offers/client/api/offers.api';
import type { OfferPayload } from '@/modules/offers/shared/offer';

const offersApiMock = jest.mocked(offersApi);

jest.mock('@/modules/offers/client/api/offers.api');
jest.mock('@/modules/offers/client/components/OfferLocation.component', () => ({
  __esModule: true,
  default: ({ location }: { location: number[] }) => (
    <div data-testid="offer-location" data-location={location.join(',')} />
  ),
}));
jest.mock('@/modules/offers/client/components/NoMeets.component', () => ({
  __esModule: true,
  default: () => <div>No meetups yet</div>,
}));

const user: React.ComponentProps<typeof OfferMeetListPage>['user'] = {
  _id: 'user-1',
};

const analytics = fakeAnalytics();

describe('OfferMeetListPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn(() => true);
  });

  it('shows the empty state when there are no meet offers', async () => {
    offersApiMock.getOffers.mockResolvedValue([]);
    render(<OfferMeetListPage user={user} />, { wrapper: analytics.wrapper });

    expect(await screen.findByText('No meetups yet')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Add new meet offer' }),
    ).toHaveAttribute('href', '/offer/meet/add');
  });

  it('lists meet offers with actions', async () => {
    offersApiMock.getOffers.mockResolvedValue([
      {
        _id: 'offer-1',
        type: 'meet',
        user: 'user-1',
        location: [51.5, -0.12],
        description: 'Coffee meetup.',
        validUntil: '2030-01-01T00:00:00.000Z',
      },
    ]);
    render(<OfferMeetListPage user={user} />, { wrapper: analytics.wrapper });

    expect(await screen.findByText('Your meetups')).toBeVisible();
    expect(screen.getByText('Coffee meetup.')).toBeInTheDocument();
    expect(screen.getByTestId('offer-location')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Modify this meet offer' }),
    ).toHaveAttribute('href', '/offer/meet/offer-1');
  });

  it('shows an empty location for a legacy offer without one', async () => {
    const legacyOffer = {
      _id: 'offer-legacy-location',
      type: 'meet',
      user: 'user-1',
      description: 'Coffee meetup.',
      validUntil: '2030-01-01T00:00:00.000Z',
    };
    Reflect.apply(
      offersApiMock.getOffers.mockResolvedValueOnce,
      offersApiMock.getOffers,
      [[legacyOffer]],
    );
    render(<OfferMeetListPage user={user} />, { wrapper: analytics.wrapper });

    expect(await screen.findByTestId('offer-location')).toHaveAttribute(
      'data-location',
      '',
    );
  });

  it('removes a meet offer after confirmation', async () => {
    offersApiMock.getOffers.mockResolvedValue([
      {
        _id: 'offer-1',
        type: 'meet',
        user: 'user-1',
        description: 'Coffee meetup.',
        location: [51.5, -0.12],
        validUntil: '2030-01-01T00:00:00.000Z',
      },
    ]);
    offersApiMock.deleteOffer.mockResolvedValue({ message: 'Offer removed.' });
    render(<OfferMeetListPage user={user} />, { wrapper: analytics.wrapper });

    fireEvent.click(
      await screen.findByRole('button', { name: 'Remove this meet offer' }),
    );

    await waitFor(() =>
      expect(screen.queryByText('Coffee meetup.')).not.toBeInTheDocument(),
    );
    expect(offersApiMock.deleteOffer).toHaveBeenCalledWith('offer-1');
    expect(analytics.track).toHaveBeenCalledWith('offer-delete', {
      type: 'meet',
    });
  });

  it('expands long descriptions when show more is clicked', async () => {
    const longDescription = `<p>${'A'.repeat(2100)}</p>`;
    offersApiMock.getOffers.mockResolvedValue([
      {
        _id: 'offer-2',
        type: 'meet',
        user: 'user-1',
        description: longDescription,
        location: [51.5, -0.12],
        validUntil: '2030-01-01T00:00:00.000Z',
      },
    ]);
    render(<OfferMeetListPage user={user} />, { wrapper: analytics.wrapper });

    expect(await screen.findByText('Show more...')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Show more...'));
    expect(screen.getByText(/^A{100,}/)).toBeInTheDocument();
  });

  it('expands the description through the fade control', async () => {
    offersApiMock.getOffers.mockResolvedValue([
      {
        _id: 'offer-fade',
        type: 'meet',
        user: 'user-1',
        description: `<p>${'B'.repeat(2100)}</p>`,
        location: [51.5, -0.12],
        validUntil: '2030-01-01T00:00:00.000Z',
      },
    ]);
    render(<OfferMeetListPage user={user} />, { wrapper: analytics.wrapper });

    await screen.findByText('Show more...');
    fireEvent.click(document.querySelector('.panel-more-excerpt')!);
    expect(screen.getByText(/^B{100,}/)).toBeInTheDocument();
  });

  it('shows an empty list when loading meet offers fails', async () => {
    offersApiMock.getOffers.mockRejectedValue(new Error('network'));
    render(<OfferMeetListPage user={user} />, { wrapper: analytics.wrapper });

    expect(await screen.findByText('No meetups yet')).toBeVisible();
  });

  it('prompts to write a description when a meet offer has none', async () => {
    offersApiMock.getOffers.mockResolvedValue([
      {
        _id: 'offer-3',
        type: 'meet',
        user: 'user-1',
        description: '',
        location: [51.5, -0.12],
        validUntil: '2030-01-01T00:00:00.000Z',
      },
    ]);
    render(<OfferMeetListPage user={user} />, { wrapper: analytics.wrapper });

    expect(await screen.findByText('No description!')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Write description' }),
    ).toHaveAttribute('href', '/offer/meet/offer-3');
  });

  it('does not remove a meet offer when confirmation is cancelled', async () => {
    window.confirm = jest.fn(() => false);
    offersApiMock.getOffers.mockResolvedValue([
      {
        _id: 'offer-1',
        type: 'meet',
        user: 'user-1',
        description: 'Coffee meetup.',
        location: [51.5, -0.12],
        validUntil: '2030-01-01T00:00:00.000Z',
      },
    ]);
    render(<OfferMeetListPage user={user} />, { wrapper: analytics.wrapper });

    fireEvent.click(
      await screen.findByRole('button', { name: 'Remove this meet offer' }),
    );

    expect(offersApiMock.deleteOffer).not.toHaveBeenCalled();
    expect(screen.getByText('Coffee meetup.')).toBeInTheDocument();
  });

  it('ignores meet offers loaded after unmounting', async () => {
    let resolveOffers!: (offers: OfferPayload[]) => void;
    offersApiMock.getOffers.mockReturnValue(
      new Promise(resolve => {
        resolveOffers = resolve;
      }),
    );

    const { unmount } = render(<OfferMeetListPage user={user} />, {
      wrapper: analytics.wrapper,
    });
    unmount();
    resolveOffers([
      {
        _id: 'offer-late',
        type: 'meet',
        user: 'user-1',
        description: 'Late meetup.',
        location: [51.5, -0.12],
        validUntil: '2030-01-01T00:00:00.000Z',
      },
    ]);
    await new Promise(resolve => setTimeout(resolve, 20));
  });

  it('handles empty and late-failing meet offer loads', async () => {
    // Exercise a malformed API response despite the declared array return type.
    Reflect.apply(
      offersApiMock.getOffers.mockResolvedValueOnce,
      offersApiMock.getOffers,
      [null],
    );
    const firstRender = render(<OfferMeetListPage user={user} />, {
      wrapper: analytics.wrapper,
    });

    expect(await screen.findByText('No meetups yet')).toBeVisible();
    firstRender.unmount();

    let rejectOffers!: (error: Error) => void;
    offersApiMock.getOffers.mockReturnValue(
      new Promise((resolve, reject) => {
        rejectOffers = reject;
      }),
    );
    const secondRender = render(<OfferMeetListPage user={user} />, {
      wrapper: analytics.wrapper,
    });
    secondRender.unmount();
    rejectOffers(new Error('late failure'));
    await new Promise(resolve => setTimeout(resolve, 20));
  });

  it('sorts meet offers by their expiry date', async () => {
    offersApiMock.getOffers.mockResolvedValue([
      {
        _id: 'offer-old',
        type: 'meet',
        user: 'user-1',
        description: 'Older meetup.',
        location: [51.5, -0.12],
        validUntil: '2029-01-01T00:00:00.000Z',
      },
      {
        _id: 'offer-new',
        type: 'meet',
        user: 'user-1',
        description: 'Newer meetup.',
        location: [51.5, -0.12],
        validUntil: '2030-01-01T00:00:00.000Z',
      },
    ]);

    render(<OfferMeetListPage user={user} />, { wrapper: analytics.wrapper });

    expect(await screen.findByText('Newer meetup.')).toBeVisible();
    const descriptions = Array.from(
      document.querySelectorAll('.panel-body'),
    ).map(node => node.textContent);
    expect(descriptions.join(' ')).toMatch(/Newer meetup.*Older meetup/);
  });
});
