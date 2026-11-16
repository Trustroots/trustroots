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
import type OfferLocationEditor from '@/modules/offers/client/components/OfferLocationEditor.component';
import { fakeAnalytics } from '@/testutils/client/analytics.testutil';
import * as offersApi from '@/modules/offers/client/api/offers.api';
import type { OfferPayload } from '@/modules/offers/shared/offer';

const offersApiMock = jest.mocked(offersApi);

jest.mock('@tanstack/react-router', () =>
  jest.requireActual('@/testutils/client/router-location.testutil'),
);
jest.mock('@/modules/offers/client/api/offers.api');
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

const analytics = fakeAnalytics();

describe('OfferHostPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, '', '/offer/host');
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: jest.fn(),
    });
    offersApiMock.getOffers.mockResolvedValue([hostOffer]);
  });

  it('keeps the three editor sections visible on one page', async () => {
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

    for (const name of ['Availability', 'Description', 'Location']) {
      const heading = await screen.findByRole('heading', { name, level: 2 });
      expect(heading.closest('section')).toHaveAttribute(
        'id',
        name.toLowerCase(),
      );
    }
    expect(
      screen.getByRole('heading', { name: 'Hosting offer' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save and Exit' })).toBeVisible();
  });

  it.each(['availability', 'description', 'location'])(
    'scrolls to the %s section from a direct link after loading',
    async id => {
      const originalScrollIntoView = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        'scrollIntoView',
      );
      const scrollIntoView = jest.fn();
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        value: scrollIntoView,
      });
      try {
        window.history.replaceState({}, '', `/offer/host#${id}`);
        render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

        const heading = await screen.findByRole('heading', {
          name: id.charAt(0).toUpperCase() + id.slice(1),
          level: 2,
        });
        await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
        expect(scrollIntoView.mock.contexts).toContain(
          heading.closest('section'),
        );
      } finally {
        if (originalScrollIntoView) {
          Object.defineProperty(
            HTMLElement.prototype,
            'scrollIntoView',
            originalScrollIntoView,
          );
        } else {
          delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
        }
      }
    },
  );

  it('does not scroll to an unrecognised section fragment', async () => {
    window.history.replaceState({}, '', '/offer/host#unknown');
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

    await screen.findByRole('radiogroup', { name: 'Can you host?' });
    expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('keeps description edits while following the location anchor', async () => {
    offersApiMock.getOffers.mockResolvedValue([]);
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });
    const description = await screen.findByLabelText(
      /Tell about your home and hosting possibilities/,
    );
    fireEvent.change(description, {
      target: { value: 'An unsaved hosting description.' },
    });
    fireEvent.click(screen.getByRole('link', { name: /Choose a location/ }));
    await waitFor(() =>
      expect(window.location.href).toContain('/offer/host#location'),
    );
    expect(
      screen.getByDisplayValue('An unsaved hosting description.'),
    ).toBeVisible();
  });

  it('opens Location for a new offer without a description', async () => {
    offersApiMock.getOffers.mockResolvedValue([]);
    window.history.replaceState({}, '', '/offer/host#location');
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });
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
      render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });
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
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });
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
      screen.getByRole('checkbox', {
        name: /People that are not in any of my circles should not find me/,
      }),
    ).toBeVisible();
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
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });
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
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

    await screen.findByRole('radiogroup', { name: 'Can you host?' });
    expect(
      within(
        screen.getByRole('radiogroup', { name: 'Can you host?' }),
      ).getByText('Yes'),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
  });

  it('creates a new host offer when saving', async () => {
    offersApiMock.getOffers.mockResolvedValue([]);
    offersApiMock.createOffer.mockResolvedValue({ message: 'Offer saved.' });
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

    await screen.findByRole('radiogroup', { name: 'Can you host?' });

    const descriptionTextareas =
      screen.getAllByPlaceholderText('Write here...');
    fireEvent.change(descriptionTextareas[descriptionTextareas.length - 1], {
      target: { value: 'Welcome to my home.' },
    });
    expect(
      screen.getByRole('button', { name: 'Save and Exit' }),
    ).toBeDisabled();
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
    expect(analytics.track).toHaveBeenCalledWith('offer_saved', {
      type: 'host',
      action: 'create',
      status: 'yes',
    });
  });

  it('updates an existing host offer when saving', async () => {
    offersApiMock.updateOffer.mockResolvedValue({ message: 'Offer updated.' });
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

    await screen.findByRole('radiogroup', { name: 'Can you host?' });

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
    expect(analytics.track).toHaveBeenCalledWith(
      'offer_saved',
      expect.objectContaining({ type: 'host', action: 'update' }),
    );
  });

  it('shows an error state when loading fails', async () => {
    window.history.replaceState({}, '', '/offer/host#location');
    offersApiMock.getOffers.mockRejectedValue(new Error('network'));
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

    expect(await screen.findByText(/Snap!/)).toBeVisible();
    expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('applies host status from route params when creating an offer', async () => {
    window.history.pushState({}, '', '/offer/host?status=maybe');
    offersApiMock.getOffers.mockResolvedValue([]);
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

    await screen.findByRole('radiogroup', { name: 'Can you host?' });
    expect(
      document.querySelector(
        '.offer-hosting-button[data-intent="warning"].active',
      ),
    ).toBeInTheDocument();
  });

  it('shows first-time location guidance for new host offers', async () => {
    offersApiMock.getOffers.mockResolvedValue([]);
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

    await screen.findByRole('radiogroup', { name: 'Can you host?' });
    const descriptionTextareas =
      screen.getAllByPlaceholderText('Write here...');
    fireEvent.change(descriptionTextareas[descriptionTextareas.length - 1], {
      target: { value: 'Welcome travellers here.' },
    });

    expect(
      await screen.findByText('Set your hosting location on the map.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Search for a place or move the map/),
    ).toBeInTheDocument();
    fireEvent.submit(document.querySelector('form')!);
    expect(offersApiMock.createOffer).not.toHaveBeenCalled();
  });

  it.each([
    ['validation', { response: { status: 400 } }],
    ['server', { response: { status: 500 } }],
    ['server', new Error('offline')],
  ])(
    'keeps the editor open when saving fails (reason %s)',
    async (reason, rejection) => {
      offersApiMock.updateOffer.mockRejectedValue(rejection);
      render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

      await screen.findByRole('radiogroup', { name: 'Can you host?' });
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
      expect(analytics.track).toHaveBeenCalledWith('offer_save_failed', {
        type: 'host',
        reason,
      });
      expect(analytics.track).not.toHaveBeenCalledWith(
        'offer_saved',
        expect.anything(),
      );
    },
  );

  it('shows no-offer fields when hosting is unavailable', async () => {
    offersApiMock.getOffers.mockResolvedValue([
      { ...hostOffer, status: 'no', description: 'Not hosting right now.' },
    ]);
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

    await screen.findByRole('radiogroup', { name: 'Can you host?' });
    fireEvent.click(
      within(
        screen.getByRole('radiogroup', { name: 'Can you host?' }),
      ).getByRole('radio', { name: 'No' }),
    );
    expect(
      screen.getByText('Tell others why you cannot host...'),
    ).toBeInTheDocument();
  });

  it('explains the location requirement when a new member cannot host', async () => {
    offersApiMock.getOffers.mockResolvedValue([]);
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

    await screen.findByRole('radiogroup', { name: 'Can you host?' });
    fireEvent.click(
      within(
        screen.getByRole('radiogroup', { name: 'Can you host?' }),
      ).getByRole('radio', { name: 'No' }),
    );

    expect(
      screen
        .getByRole('link', { name: /Choose a location/ })
        .closest('[role="status"]'),
    ).toHaveTextContent(/Choose a location.*before saving/);
    expect(
      screen.getByRole('link', { name: /Choose a location/ }),
    ).toHaveAttribute('href', '/offer/host#location');
    expect(document.getElementById('location')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save and Exit' }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('link', { name: /Choose a location/ }));
    await waitFor(() =>
      expect(window.location.href).toContain('/offer/host#location'),
    );
  });

  it('adjusts guest count and circle visibility settings', async () => {
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

    await screen.findByRole('radiogroup', { name: 'Can you host?' });
    fireEvent.click(
      document.querySelector('.offer-maxguests .icon-plus')!.closest('button')!,
    );
    expect(screen.getByDisplayValue('3')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /People that are not in any of my circles should not find me/,
      }),
    );
    expect(
      screen.getByRole('checkbox', {
        name: /People that are not in any of my circles should not find me/,
      }),
    ).toBeChecked();
  });

  it('ignores offer results after unmounting during load', async () => {
    let resolveOffers!: (offers: OfferPayload[]) => void;
    offersApiMock.getOffers.mockReturnValue(
      new Promise<OfferPayload[]>(resolve => {
        resolveOffers = resolve;
      }),
    );

    const { unmount } = render(<OfferHostPage user={user} />, {
      wrapper: analytics.wrapper,
    });
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

    const { unmount } = render(<OfferHostPage user={user} />, {
      wrapper: analytics.wrapper,
    });
    unmount();
    rejectOffers(new Error('late failure'));
    await new Promise(resolve => setTimeout(resolve, 20));
  });

  it('overrides a loaded offer status from route params', async () => {
    window.history.pushState({}, '', '/offer/host?status=no');
    offersApiMock.getOffers.mockResolvedValue([hostOffer]);
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

    await screen.findByRole('radiogroup', { name: 'Can you host?' });
    expect(
      document.querySelector(
        '.offer-hosting-button[data-intent="danger"].active',
      ),
    ).toBeInTheDocument();
  });

  it('does not submit when the description is too short', async () => {
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

    await screen.findByRole('radiogroup', { name: 'Can you host?' });
    const descriptionTextareas =
      screen.getAllByPlaceholderText('Write here...');
    fireEvent.change(descriptionTextareas[descriptionTextareas.length - 1], {
      target: { value: 'Hi' },
    });
    fireEvent.submit(document.querySelector('form')!);

    expect(offersApiMock.updateOffer).not.toHaveBeenCalled();
  });

  it('changes host status, guest count, and no-offer description', async () => {
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

    await screen.findByRole('radiogroup', { name: 'Can you host?' });
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
    fireEvent.change(screen.getAllByPlaceholderText('Write here...')[0], {
      target: { value: 'Not hosting this month.' },
    });
  });

  it('closes first-time location guidance and updates the location', async () => {
    offersApiMock.getOffers.mockResolvedValue([]);
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

    await screen.findByRole('radiogroup', { name: 'Can you host?' });
    fireEvent.change(screen.getByPlaceholderText('Write here...'), {
      target: { value: 'A welcoming place to stay.' },
    });
    fireEvent.click(document.querySelector('.offer-map-guide button')!);
    fireEvent.click(screen.getByRole('button', { name: 'Change location' }));
  });
});
