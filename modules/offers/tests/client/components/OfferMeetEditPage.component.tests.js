import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import OfferMeetEditPage from '@/modules/offers/client/components/OfferMeetEditPage.component';
import * as offersApi from '@/modules/offers/client/api/offers.api';

jest.mock('@/modules/offers/client/api/offers.api');
jest.mock('@/modules/core/client/services/client-runtime', () => ({
  trackEvent: jest.fn(),
  getCurrentRouteParams: jest.fn(() => ({})),
}));
jest.mock(
  '@/modules/offers/client/components/MeetsExplanation.component',
  () => ({
    __esModule: true,
    default: () => <div>Meets explanation</div>,
  }),
);
jest.mock(
  '@/modules/offers/client/components/OfferLocationEditor.component',
  () => ({
    __esModule: true,
    default: ({ onLocationChange }) => (
      <div data-testid="location-editor">
        <button type="button" onClick={() => onLocationChange([52, 4])}>
          Change location
        </button>
      </div>
    ),
  }),
);

describe('OfferMeetEditPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const {
      getCurrentRouteParams,
    } = require('@/modules/core/client/services/client-runtime');
    getCurrentRouteParams.mockReturnValue({});
  });

  it('renders a new meet offer form', async () => {
    render(<OfferMeetEditPage user={{ _id: 'user-1' }} />);

    expect(await screen.findByText('What is this about?')).toBeVisible();
    expect(screen.getByText('Meets explanation')).toBeInTheDocument();
    expect(
      screen.getByLabelText('How long should this be visible?'),
    ).toBeInTheDocument();
  });

  it('creates a new meet offer after filling details', async () => {
    offersApi.createOffer.mockResolvedValue({});
    render(<OfferMeetEditPage user={{ _id: 'user-1' }} />);

    fireEvent.change(await screen.findByPlaceholderText('Write here...'), {
      target: { value: 'Coffee in the park.' },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Location' }));
    expect(await screen.findByTestId('location-editor')).toBeInTheDocument();
    fireEvent.submit(document.querySelector('form'));

    await waitFor(() => {
      expect(offersApi.createOffer).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Coffee in the park.',
          type: 'meet',
        }),
      );
    });
  });

  it('loads and updates an existing meet offer', async () => {
    const {
      getCurrentRouteParams,
    } = require('@/modules/core/client/services/client-runtime');
    getCurrentRouteParams.mockReturnValue({ offerId: 'offer-1' });
    offersApi.getOffer.mockResolvedValue({
      _id: 'offer-1',
      description: 'Existing meet.',
      location: [51.5, -0.12],
      validUntil: new Date(Date.now() + 86400000).toISOString(),
    });
    offersApi.updateOffer.mockResolvedValue({});

    render(<OfferMeetEditPage user={{ _id: 'user-1' }} />);

    fireEvent.change(await screen.findByPlaceholderText('Write here...'), {
      target: { value: 'Updated meet description.' },
    });
    fireEvent.submit(document.querySelector('form'));

    await waitFor(() => {
      expect(offersApi.updateOffer).toHaveBeenCalledWith(
        'offer-1',
        expect.objectContaining({
          description: 'Updated meet description.',
        }),
      );
    });
  });

  it('keeps loading when an existing meet offer cannot be loaded', async () => {
    const {
      getCurrentRouteParams,
    } = require('@/modules/core/client/services/client-runtime');
    getCurrentRouteParams.mockReturnValue({ offerId: 'missing-offer' });
    offersApi.getOffer.mockRejectedValue(new Error('not found'));

    render(<OfferMeetEditPage user={{ _id: 'user-1' }} />);

    expect(await screen.findByText('Wait a moment…')).toBeInTheDocument();
  });

  it('stays on the form when saving a new meet offer fails', async () => {
    offersApi.createOffer.mockRejectedValue(new Error('save failed'));
    render(<OfferMeetEditPage user={{ _id: 'user-1' }} />);

    fireEvent.change(await screen.findByPlaceholderText('Write here...'), {
      target: { value: 'Coffee in the park.' },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Location' }));
    fireEvent.submit(document.querySelector('form'));

    await waitFor(() => {
      expect(offersApi.createOffer).toHaveBeenCalled();
    });
    expect(screen.getByText('What is this about?')).toBeInTheDocument();
  });

  it('ignores loaded meet offers after unmounting', async () => {
    const {
      getCurrentRouteParams,
    } = require('@/modules/core/client/services/client-runtime');
    getCurrentRouteParams.mockReturnValue({ offerId: 'offer-1' });

    let resolveOffer;
    offersApi.getOffer.mockReturnValue(
      new Promise(resolve => {
        resolveOffer = resolve;
      }),
    );

    const { unmount } = render(<OfferMeetEditPage user={{ _id: 'user-1' }} />);
    unmount();
    resolveOffer({
      _id: 'offer-1',
      description: 'Late offer.',
      location: [51.5, -0.12],
      validUntil: new Date(Date.now() + 86400000).toISOString(),
    });
    await new Promise(resolve => setTimeout(resolve, 20));
  });

  it('uses a default expiry date for loaded meet offers without one', async () => {
    const {
      getCurrentRouteParams,
    } = require('@/modules/core/client/services/client-runtime');
    getCurrentRouteParams.mockReturnValue({ offerId: 'offer-without-expiry' });
    offersApi.getOffer.mockResolvedValue({
      _id: 'offer-without-expiry',
      description: 'Coffee in the park.',
      location: [51.5, -0.12],
    });

    render(<OfferMeetEditPage user={{ _id: 'user-1' }} />);

    expect(
      (await screen.findByLabelText('How long should this be visible?')).value,
    ).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('ignores failed meet offer loads after unmounting', async () => {
    const {
      getCurrentRouteParams,
    } = require('@/modules/core/client/services/client-runtime');
    getCurrentRouteParams.mockReturnValue({ offerId: 'offer-1' });

    let rejectOffer;
    offersApi.getOffer.mockReturnValue(
      new Promise((resolve, reject) => {
        rejectOffer = reject;
      }),
    );

    const { unmount } = render(<OfferMeetEditPage user={{ _id: 'user-1' }} />);
    unmount();
    rejectOffer(new Error('late failure'));
    await new Promise(resolve => setTimeout(resolve, 20));
  });

  it('does not submit an empty meet offer', async () => {
    render(<OfferMeetEditPage user={{ _id: 'user-1' }} />);

    expect(await screen.findByText('What is this about?')).toBeVisible();
    fireEvent.submit(document.querySelector('form'));

    expect(offersApi.createOffer).not.toHaveBeenCalled();
  });

  it('edits the expiry date and navigates between sections', async () => {
    render(<OfferMeetEditPage user={{ _id: 'user-1' }} />);

    fireEvent.change(await screen.findByPlaceholderText('Write here...'), {
      target: { value: 'Coffee in the park.' },
    });
    fireEvent.change(
      screen.getByLabelText('How long should this be visible?'),
      {
        target: { value: '2030-01-01' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next section' }));
    expect(await screen.findByTestId('location-editor')).toBeInTheDocument();
    fireEvent.click(
      document.querySelector('[data-testid="location-editor"] button'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Previous section' }));
    expect(screen.getByText('What is this about?')).toBeVisible();
  });
});
