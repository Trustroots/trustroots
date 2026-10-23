import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom';

import OfferHostPage from '@/modules/offers/client/components/OfferHostPage.component';
import type { TabsProps } from 'react-bootstrap';
import type OfferLocationEditor from '@/modules/offers/client/components/OfferLocationEditor.component';
import { getCurrentRouteParams } from '@/modules/core/client/services/client-runtime';
import * as offersApi from '@/modules/offers/client/api/offers.api';
import type { OfferPayload } from '@/modules/offers/shared/offer';

const offersApiMock = jest.mocked(offersApi);

jest.mock('react-bootstrap', () => {
  const ReactBootstrap =
    jest.requireActual<typeof import('react-bootstrap')>('react-bootstrap');

  return {
    ...ReactBootstrap,
    Tabs: (props: TabsProps) => (
      <>
        <ReactBootstrap.Tabs {...props} />
        <button onClick={event => props.onSelect?.(null, event)} type="button">
          Clear selected tab
        </button>
      </>
    ),
  };
});

jest.mock('@/modules/offers/client/api/offers.api');
jest.mock('@/modules/core/client/services/client-runtime', () => ({
  trackEvent: jest.fn(),
  getCurrentRouteParams: jest.fn(() => ({})),
}));

const getCurrentRouteParamsMock = jest.mocked(getCurrentRouteParams);
jest.mock(
  '@/modules/offers/client/components/OfferLocationEditor.component',
  () => ({
    __esModule: true,
    default: ({
      onLocationChange,
    }: React.ComponentProps<typeof OfferLocationEditor>) => (
      <div data-testid="location-editor">
        <button type="button" onClick={() => onLocationChange([52, 4])}>
          Change location
        </button>
      </div>
    ),
  }),
);

const user: React.ComponentProps<typeof OfferHostPage>['user'] = {
  _id: 'user-1',
  username: 'ada',
};

const hostOffer: OfferPayload = {
  _id: 'offer-1',
  type: 'host',
  user: 'user-1',
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
    window.history.replaceState({}, '', '/offer/host');
    offersApiMock.getOffers.mockResolvedValue([hostOffer]);
    getCurrentRouteParamsMock.mockReturnValue({});
  });

  it.each(['availability', 'description', 'location'])(
    'opens the %s tab from a direct link',
    async tab => {
      window.history.replaceState({}, '', `/offer/host#${tab}`);
      render(<OfferHostPage user={user} />);

      expect(
        await screen.findByRole('tab', { name: new RegExp(tab, 'i') }),
      ).toHaveAttribute('aria-selected', 'true');
    },
  );

  it('falls back to Availability for an unknown fragment', async () => {
    window.history.replaceState({}, '', '/offer/host#unknown');
    render(<OfferHostPage user={user} />);
    expect(
      await screen.findByRole('tab', { name: 'Availability' }),
    ).toHaveAttribute('aria-selected', 'true');
  });

  it('updates the fragment and follows history without losing edits', async () => {
    render(<OfferHostPage user={user} />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Description' }));
    expect(window.location.hash).toBe('#description');
    fireEvent.change(
      screen.getByLabelText(/Tell about your home and hosting possibilities/),
      { target: { value: 'An unsaved hosting description.' } },
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Location' }));
    expect(window.location.hash).toBe('#location');

    window.history.replaceState({}, '', '/offer/host#description');
    fireEvent.popState(window);
    expect(screen.getByRole('tab', { name: 'Description' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.getByDisplayValue('An unsaved hosting description.'),
    ).toBeVisible();

    window.history.replaceState({}, '', '/offer/host#location');
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(screen.getByRole('tab', { name: 'Location' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('opens Location for a new offer without a description', async () => {
    offersApiMock.getOffers.mockResolvedValue([]);
    window.history.replaceState({}, '', '/offer/host#location');
    render(<OfferHostPage user={user} />);
    expect(await screen.findByTestId('location-editor')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Save and Exit' }),
    ).toBeDisabled();
  });

  it.each(['yes', 'maybe', 'no'] as const)(
    'saves meeting availability independently for hosting status %s',
    async status => {
      offersApiMock.getOffers.mockResolvedValue([
        { ...hostOffer, status, meetingStatus: 'yes' },
      ]);
      render(<OfferHostPage user={user} />);
      const group = within(
        await screen.findByRole('radiogroup', {
          name: 'Would you like to meet people?',
        }),
      );
      const meeting = group.getByRole('radio', { name: 'Yes' });
      expect(meeting).toBeChecked();
      fireEvent.click(group.getByRole('radio', { name: 'No' }));
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() =>
        expect(offersApiMock.updateOffer).toHaveBeenCalledWith(
          'offer-1',
          expect.objectContaining({ status, meetingStatus: 'no' }),
        ),
      );
    },
  );

  it('lets a non-host opt into meetings and change location without a description', async () => {
    offersApiMock.getOffers.mockResolvedValue([
      { ...hostOffer, status: 'no', description: '' },
    ]);
    render(<OfferHostPage user={user} />);
    const meeting = within(
      await screen.findByRole('radiogroup', {
        name: 'Would you like to meet people?',
      }),
    ).getByRole('radio', { name: 'Yes' });
    expect(meeting).not.toBeChecked();
    expect(screen.getByText(/You will not appear on the map/)).toBeVisible();
    fireEvent.click(meeting);
    expect(screen.getByText(/for meetings, but not as a host/)).toBeVisible();
    expect(
      screen.getByLabelText(/People that are not in any of my circles/),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Location' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change location' }));
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() =>
      expect(offersApiMock.updateOffer).toHaveBeenCalledWith(
        'offer-1',
        expect.objectContaining({
          status: 'no',
          meetingStatus: 'yes',
          location: [52, 4],
        }),
      ),
    );
  });

  it('explains hosting and meeting visibility together', async () => {
    render(<OfferHostPage user={user} />);
    const meeting = within(
      await screen.findByRole('radiogroup', {
        name: 'Would you like to meet people?',
      }),
    ).getByRole('radio', { name: 'Yes' });
    expect(
      screen.getByText(/You will appear on the map for hosting\./),
    ).toBeVisible();
    fireEvent.click(meeting);
    expect(screen.getByText(/for hosting and meetings/)).toBeVisible();
  });

  it('loads the host offer editor with availability controls', async () => {
    render(<OfferHostPage user={user} />);

    expect(await screen.findByText('Can you host?')).toBeVisible();
    expect(
      within(
        screen.getByRole('radiogroup', { name: 'Can you host?' }),
      ).getByText('Yes'),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
  });

  it('keeps the active tab when selection is cleared', async () => {
    render(<OfferHostPage user={user} />);

    expect(await screen.findByText('Can you host?')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Clear selected tab' }));

    expect(screen.getByRole('tab', { name: 'Availability' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('creates a new host offer when saving', async () => {
    offersApiMock.getOffers.mockResolvedValue([]);
    offersApiMock.createOffer.mockResolvedValue({ message: 'Offer saved.' });
    render(<OfferHostPage user={user} />);

    expect(await screen.findByText('Can you host?')).toBeVisible();

    fireEvent.click(screen.getByRole('tab', { name: 'Description' }));
    const descriptionTextareas =
      screen.getAllByPlaceholderText('Write here...');
    fireEvent.change(descriptionTextareas[descriptionTextareas.length - 1], {
      target: { value: 'Welcome to my home.' },
    });
    expect(
      screen.getByRole('button', { name: 'Save and Exit' }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('tab', { name: 'Location' }));
    fireEvent.click(
      document.querySelector('[data-testid="location-editor"] button')!,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save and Exit' }));

    await waitFor(() => {
      expect(offersApiMock.createOffer).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Welcome to my home.',
          status: 'yes',
          type: 'host',
          location: [52, 4],
        }),
      );
    });
  });

  it('updates an existing host offer when saving', async () => {
    offersApiMock.updateOffer.mockResolvedValue({ message: 'Offer updated.' });
    render(<OfferHostPage user={user} />);

    expect(await screen.findByText('Can you host?')).toBeVisible();

    fireEvent.click(screen.getByRole('tab', { name: 'Description' }));
    const descriptionTextareas =
      screen.getAllByPlaceholderText('Write here...');
    fireEvent.change(descriptionTextareas[descriptionTextareas.length - 1], {
      target: { value: 'Updated hosting description.' },
    });
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => {
      expect(offersApiMock.updateOffer).toHaveBeenCalledWith(
        'offer-1',
        expect.objectContaining({
          description: 'Updated hosting description.',
        }),
      );
    });
  });

  it('shows an error state when loading fails', async () => {
    offersApiMock.getOffers.mockRejectedValue(new Error('network'));
    render(<OfferHostPage user={user} />);

    expect(await screen.findByText(/Snap!/)).toBeVisible();
  });

  it('applies host status from route params when creating an offer', async () => {
    getCurrentRouteParamsMock.mockReturnValue({ status: 'maybe' });
    offersApiMock.getOffers.mockResolvedValue([]);
    render(<OfferHostPage user={user} />);

    expect(await screen.findByText('Can you host?')).toBeVisible();
    expect(
      document.querySelector('.btn-offer-hosting-maybe.active'),
    ).toBeInTheDocument();
  });

  it('shows first-time location guidance for new host offers', async () => {
    offersApiMock.getOffers.mockResolvedValue([]);
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
    expect(
      screen.getByText(/Search for a place or move the map/),
    ).toBeInTheDocument();
    fireEvent.submit(document.querySelector('form')!);
    expect(offersApiMock.createOffer).not.toHaveBeenCalled();
  });

  it('keeps the editor open when saving fails', async () => {
    offersApiMock.updateOffer.mockRejectedValue(new Error('save failed'));
    render(<OfferHostPage user={user} />);

    expect(await screen.findByText('Can you host?')).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Description' }));
    const descriptionTextareas =
      screen.getAllByPlaceholderText('Write here...');
    fireEvent.change(descriptionTextareas[descriptionTextareas.length - 1], {
      target: { value: 'Updated hosting description.' },
    });
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => {
      expect(offersApiMock.updateOffer).toHaveBeenCalled();
    });
    expect(screen.getByText('Can you host?')).toBeInTheDocument();
  });

  it('shows no-offer fields when hosting is unavailable', async () => {
    offersApiMock.getOffers.mockResolvedValue([
      { ...hostOffer, status: 'no', description: 'Not hosting right now.' },
    ]);
    render(<OfferHostPage user={user} />);

    expect(await screen.findByText('Can you host?')).toBeVisible();
    fireEvent.click(
      within(
        screen.getByRole('radiogroup', { name: 'Can you host?' }),
      ).getByRole('radio', { name: 'No' }),
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Description' }));

    expect(
      screen.getByText('Tell others why you cannot host...'),
    ).toBeInTheDocument();
  });

  it('explains the location requirement when a new member cannot host', async () => {
    offersApiMock.getOffers.mockResolvedValue([]);
    render(<OfferHostPage user={user} />);

    expect(await screen.findByText('Can you host?')).toBeVisible();
    fireEvent.click(
      within(
        screen.getByRole('radiogroup', { name: 'Can you host?' }),
      ).getByRole('radio', { name: 'No' }),
    );

    expect(
      screen
        .getByRole('link', { name: 'Choose a location' })
        .closest('[role="status"]'),
    ).toHaveTextContent('Choose a location in the Location tab before saving');
    expect(
      screen.getByRole('link', { name: 'Choose a location' }),
    ).toHaveAttribute('href', '#location');
    expect(screen.getByRole('tab', { name: 'Location' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Save and Exit' }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('link', { name: 'Choose a location' }));
    expect(screen.getByRole('tab', { name: 'Location' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(window.location.hash).toBe('#location');
  });

  it('adjusts guest count and circle visibility settings', async () => {
    render(<OfferHostPage user={user} />);

    expect(await screen.findByText('Can you host?')).toBeVisible();
    fireEvent.click(
      document.querySelector('.offer-maxguests .icon-plus')!.closest('button')!,
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
    let resolveOffers!: (offers: OfferPayload[]) => void;
    offersApiMock.getOffers.mockReturnValue(
      new Promise<OfferPayload[]>(resolve => {
        resolveOffers = resolve;
      }),
    );

    const { unmount } = render(<OfferHostPage user={user} />);
    unmount();
    resolveOffers([hostOffer]);
    await new Promise(resolve => setTimeout(resolve, 20));
  });

  it('ignores offer load failures after unmounting', async () => {
    let rejectOffers!: (error: Error) => void;
    offersApiMock.getOffers.mockReturnValue(
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
    getCurrentRouteParamsMock.mockReturnValue({ status: 'no' });
    offersApiMock.getOffers.mockResolvedValue([hostOffer]);
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
    fireEvent.submit(document.querySelector('form')!);

    expect(offersApiMock.updateOffer).not.toHaveBeenCalled();
  });

  it('changes host status, guest count, and no-offer description', async () => {
    render(<OfferHostPage user={user} />);

    expect(await screen.findByText('Can you host?')).toBeVisible();
    fireEvent.click(
      within(
        screen.getByRole('radiogroup', { name: 'Can you host?' }),
      ).getByRole('radio', { name: 'Maybe' }),
    );
    fireEvent.click(document.querySelector('.offer-maxguests button')!);
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '' },
    });
    fireEvent.click(
      within(
        screen.getByRole('radiogroup', { name: 'Can you host?' }),
      ).getByRole('radio', { name: 'No' }),
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Description' }));
    fireEvent.change(screen.getAllByPlaceholderText('Write here...')[0], {
      target: { value: 'Not hosting this month.' },
    });
  });

  it('closes first-time location guidance and updates the location', async () => {
    offersApiMock.getOffers.mockResolvedValue([]);
    render(<OfferHostPage user={user} />);

    expect(await screen.findByText('Can you host?')).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Description' }));
    fireEvent.change(screen.getByPlaceholderText('Write here...'), {
      target: { value: 'A welcoming place to stay.' },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Location' }));
    fireEvent.click(document.querySelector('.offer-map-guide button')!);
    fireEvent.click(screen.getByRole('button', { name: 'Change location' }));
  });
});
