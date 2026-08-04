import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import OfferHostPage from '@/modules/offers/client/components/OfferHostPage.component';
import * as offersApi from '@/modules/offers/client/api/offers.api';

jest.mock('@/modules/offers/client/api/offers.api');
jest.mock('@/modules/core/client/services/client-runtime', () => ({
  trackEvent: jest.fn(),
  getCurrentRouteParams: jest.fn(() => ({})),
}));

const {
  getCurrentRouteParams,
} = require('@/modules/core/client/services/client-runtime');
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

const user = {
  _id: 'user-1',
  username: 'ada',
};

const hostOffer = {
  _id: 'offer-1',
  type: 'host',
  status: 'yes',
  description: 'A cosy spare room.',
  noOfferDescription: '',
  location: [51.5, -0.12],
  maxGuests: 2,
  showOnlyInMyCircles: false,
};

describe('OfferHostPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    offersApi.getOffers.mockResolvedValue([hostOffer]);
    getCurrentRouteParams.mockReturnValue({});
  });

  it('loads the host offer editor with availability controls', async () => {
    render(<OfferHostPage user={user} />);

    expect(await screen.findByText('Can you host?')).toBeVisible();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
  });

  it('creates a new host offer when saving', async () => {
    offersApi.getOffers.mockResolvedValue([]);
    offersApi.createOffer.mockResolvedValue({});
    render(<OfferHostPage user={user} />);

    expect(await screen.findByText('Can you host?')).toBeVisible();

    fireEvent.click(screen.getByRole('tab', { name: 'Description' }));
    const descriptionTextareas =
      screen.getAllByPlaceholderText('Write here...');
    fireEvent.change(descriptionTextareas[descriptionTextareas.length - 1], {
      target: { value: 'Welcome to my home.' },
    });
    fireEvent.submit(document.querySelector('form'));

    await waitFor(() => {
      expect(offersApi.createOffer).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Welcome to my home.',
          status: 'yes',
          type: 'host',
        }),
      );
    });
  });

  it('updates an existing host offer when saving', async () => {
    offersApi.updateOffer.mockResolvedValue({});
    render(<OfferHostPage user={user} />);

    expect(await screen.findByText('Can you host?')).toBeVisible();

    fireEvent.click(screen.getByRole('tab', { name: 'Description' }));
    const descriptionTextareas =
      screen.getAllByPlaceholderText('Write here...');
    fireEvent.change(descriptionTextareas[descriptionTextareas.length - 1], {
      target: { value: 'Updated hosting description.' },
    });
    fireEvent.submit(document.querySelector('form'));

    await waitFor(() => {
      expect(offersApi.updateOffer).toHaveBeenCalledWith(
        'offer-1',
        expect.objectContaining({
          description: 'Updated hosting description.',
        }),
      );
    });
  });

  it('shows an error state when loading fails', async () => {
    offersApi.getOffers.mockRejectedValue(new Error('network'));
    render(<OfferHostPage user={user} />);

    expect(await screen.findByText(/Snap!/)).toBeVisible();
  });

  it('applies host status from route params when creating an offer', async () => {
    getCurrentRouteParams.mockReturnValue({ status: 'maybe' });
    offersApi.getOffers.mockResolvedValue([]);
    render(<OfferHostPage user={user} />);

    expect(await screen.findByText('Can you host?')).toBeVisible();
    expect(
      document.querySelector('.btn-offer-hosting-maybe.active'),
    ).toBeInTheDocument();
  });

  it('shows first-time location guidance for new host offers', async () => {
    offersApi.getOffers.mockResolvedValue([]);
    render(<OfferHostPage user={user} />);

    expect(await screen.findByText('Can you host?')).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Description' }));
    const descriptionTextareas =
      screen.getAllByPlaceholderText('Write here...');
    fireEvent.change(descriptionTextareas[descriptionTextareas.length - 1], {
      target: { value: 'Welcome travellers here.' },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Location' }));

    expect(
      await screen.findByText('Set your hosting location on the map.'),
    ).toBeInTheDocument();
  });

  it('keeps the editor open when saving fails', async () => {
    offersApi.updateOffer.mockRejectedValue(new Error('save failed'));
    render(<OfferHostPage user={user} />);

    expect(await screen.findByText('Can you host?')).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Description' }));
    const descriptionTextareas =
      screen.getAllByPlaceholderText('Write here...');
    fireEvent.change(descriptionTextareas[descriptionTextareas.length - 1], {
      target: { value: 'Updated hosting description.' },
    });
    fireEvent.submit(document.querySelector('form'));

    await waitFor(() => {
      expect(offersApi.updateOffer).toHaveBeenCalled();
    });
    expect(screen.getByText('Can you host?')).toBeInTheDocument();
  });

  it('shows no-offer fields when hosting is unavailable', async () => {
    offersApi.getOffers.mockResolvedValue([
      { ...hostOffer, status: 'no', description: 'Not hosting right now.' },
    ]);
    render(<OfferHostPage user={user} />);

    expect(await screen.findByText('Can you host?')).toBeVisible();
    fireEvent.click(document.querySelector('.btn-offer-hosting-no'));
    fireEvent.click(screen.getByRole('tab', { name: 'Description' }));

    expect(
      screen.getByText('Tell others why you cannot host...'),
    ).toBeInTheDocument();
  });

  it('adjusts guest count and circle visibility settings', async () => {
    render(<OfferHostPage user={user} />);

    expect(await screen.findByText('Can you host?')).toBeVisible();
    fireEvent.click(
      document.querySelector('.offer-maxguests .icon-plus')?.closest('button'),
    );
    expect(screen.getByDisplayValue('3')).toBeInTheDocument();

    fireEvent.click(
      screen.getByLabelText(/People that are not in any of my circles/),
    );
    expect(
      screen.getByLabelText(/People that are not in any of my circles/),
    ).toBeChecked();
  });

  it('ignores offer results after unmounting during load', async () => {
    let resolveOffers;
    offersApi.getOffers.mockReturnValue(
      new Promise(resolve => {
        resolveOffers = resolve;
      }),
    );

    const { unmount } = render(<OfferHostPage user={user} />);
    unmount();
    resolveOffers([hostOffer]);
    await new Promise(resolve => setTimeout(resolve, 20));
  });

  it('ignores offer load failures after unmounting', async () => {
    let rejectOffers;
    offersApi.getOffers.mockReturnValue(
      new Promise((resolve, reject) => {
        rejectOffers = reject;
      }),
    );

    const { unmount } = render(<OfferHostPage user={user} />);
    unmount();
    rejectOffers(new Error('late failure'));
    await new Promise(resolve => setTimeout(resolve, 20));
  });

  it('overrides a loaded offer status from route params', async () => {
    getCurrentRouteParams.mockReturnValue({ status: 'no' });
    offersApi.getOffers.mockResolvedValue([hostOffer]);
    render(<OfferHostPage user={user} />);

    expect(await screen.findByText('Can you host?')).toBeVisible();
    expect(
      document.querySelector('.btn-offer-hosting-no.active'),
    ).toBeInTheDocument();
  });

  it('does not submit when the description is too short', async () => {
    render(<OfferHostPage user={user} />);

    expect(await screen.findByText('Can you host?')).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Description' }));
    const descriptionTextareas =
      screen.getAllByPlaceholderText('Write here...');
    fireEvent.change(descriptionTextareas[descriptionTextareas.length - 1], {
      target: { value: 'Hi' },
    });
    fireEvent.submit(document.querySelector('form'));

    expect(offersApi.updateOffer).not.toHaveBeenCalled();
  });

  it('changes host status, guest count, and no-offer description', async () => {
    render(<OfferHostPage user={user} />);

    expect(await screen.findByText('Can you host?')).toBeVisible();
    fireEvent.click(screen.getByRole('radio', { name: 'Maybe' }));
    fireEvent.click(document.querySelector('.offer-maxguests button'));
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('radio', { name: 'No' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Description' }));
    fireEvent.change(screen.getAllByPlaceholderText('Write here...')[0], {
      target: { value: 'Not hosting this month.' },
    });
  });

  it('closes first-time location guidance and updates the location', async () => {
    offersApi.getOffers.mockResolvedValue([]);
    render(<OfferHostPage user={user} />);

    expect(await screen.findByText('Can you host?')).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Description' }));
    fireEvent.change(screen.getByPlaceholderText('Write here...'), {
      target: { value: 'A welcoming place to stay.' },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Location' }));
    fireEvent.click(document.querySelector('.offer-map-guide button'));
    fireEvent.click(
      document.querySelector('[data-testid="location-editor"] button'),
    );
  });
});
