import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import OfferHostPage from '@/modules/offers/client/components/OfferHostPage.component';
import type OfferLocationEditor from '@/modules/offers/client/components/OfferLocationEditor.component';
import { DEFAULT_LOCATION } from '@/modules/core/client/utils/constants';
import { fakeAnalytics } from '@/testutils/client/analytics.testutil';
import * as offersApi from '@/modules/offers/client/api/offers.api';
import type {
  OfferMutationResponse,
  OfferPayload,
} from '@/modules/offers/shared/offer';

const offersApiMock = vi.mocked(offersApi);
type BlockerOptions = {
  shouldBlockFn: (args: {
    current: { pathname: string; search: Record<string, unknown> };
    next: { pathname: string; search: Record<string, unknown> };
  }) => boolean;
  enableBeforeUnload: () => boolean;
};
const mockUseBlocker = vi.fn<(...args: [BlockerOptions]) => void>();
const getLatestBlockerOptions = () => {
  const calls = mockUseBlocker.mock.calls;
  return calls[calls.length - 1]![0];
};
const hasUnsavedChanges = () => getLatestBlockerOptions().enableBeforeUnload();

vi.mock('@tanstack/react-router', async () => ({
  ...(await (
    await import('@/testutils/client/router-location.testutil')
  ).mockRouterModule()),
  useBlocker: (options: BlockerOptions) => mockUseBlocker(options),
}));
vi.mock('@/modules/offers/client/api/offers.api');
vi.mock(
  '@/modules/offers/client/components/OfferLocationEditor.component',
  () => ({
    __esModule: true,
    default: ({
      onLocationChange,
      showHostingGuide,
    }: React.ComponentProps<typeof OfferLocationEditor>) => (
      <div data-testid="location-editor" data-show-guide={showHostingGuide}>
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
  it.each([undefined, false, true])(
    'loads and saves the volunteering toggle: %s',
    async volunteering => {
      offersApiMock.getOffers.mockResolvedValue([
        { ...hostOffer, volunteering },
      ]);
      offersApiMock.updateOffer.mockResolvedValue({
        message: 'Offer updated.',
      });
      render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

      const toggle = await screen.findByRole('checkbox', {
        name: 'Volunteering: can your guests help you with something?',
      });
      if (volunteering === true) {
        expect(toggle).toBeChecked();
      } else {
        expect(toggle).not.toBeChecked();
      }
      expect(
        screen.getByText(/whether it is optional or expected/),
      ).toBeVisible();
      fireEvent.click(toggle);
      expect(hasUnsavedChanges()).toBe(true);

      await waitFor(() =>
        expect(offersApiMock.updateOffer).toHaveBeenCalledWith(
          'offer-1',
          expect.objectContaining({ volunteering: volunteering !== true }),
        ),
      );
    },
  );

  it('defaults acknowledgement off, persists opting in and reloads the preference', async () => {
    offersApiMock.updateOffer.mockResolvedValue({ message: 'Offer updated.' });
    const { unmount } = render(<OfferHostPage user={user} />, {
      wrapper: analytics.wrapper,
    });
    const descriptionRegion = await screen.findByRole('region', {
      name: 'Description',
    });
    const checkbox = within(descriptionRegion).getByRole('checkbox', {
      name: /Require guests to acknowledge/,
    });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(hasUnsavedChanges()).toBe(true);
    await waitFor(() =>
      expect(offersApiMock.updateOffer).toHaveBeenCalledWith(
        'offer-1',
        expect.objectContaining({
          requireHostingDescriptionAcknowledgement: true,
        }),
      ),
    );
    await waitFor(() => expect(hasUnsavedChanges()).toBe(false));
    unmount();
    offersApiMock.getOffers.mockResolvedValue([
      { ...hostOffer, requireHostingDescriptionAcknowledgement: true },
    ]);
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });
    expect(
      await screen.findByRole('checkbox', {
        name: /Require guests to acknowledge/,
      }),
    ).toBeChecked();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    offersApiMock.createOffer.mockResolvedValue({
      message: 'Offer saved.',
      _id: 'new-host',
    });
    offersApiMock.updateOffer.mockResolvedValue({ message: 'Offer updated.' });
    window.history.replaceState({}, '', '/offer/host');
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    offersApiMock.getOffers.mockResolvedValue([hostOffer]);
  });

  it('keeps the three editor sections visible on one page', async () => {
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

    for (const name of ['Availability', 'Description', 'Location']) {
      const section = await screen.findByRole('region', { name });
      expect(section).toHaveAttribute('id', name.toLowerCase());
    }
    expect(
      screen.getByRole('heading', { name: 'Hosting offer' }),
    ).toBeVisible();
    expect(screen.getByText('All changes saved')).toBeVisible();
  });

  it.each(['availability', 'description', 'location'])(
    'scrolls to the %s section from a direct link after loading',
    async id => {
      const originalScrollIntoView = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        'scrollIntoView',
      );
      const scrollIntoView = vi.fn();
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        value: scrollIntoView,
      });
      try {
        window.history.replaceState({}, '', `/offer/host#${id}`);
        render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

        const section = await screen.findByRole('region', {
          name: id.charAt(0).toUpperCase() + id.slice(1),
        });
        await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
        expect(scrollIntoView.mock.contexts).toContain(section);
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

  it('blocks leaving unsaved changes and allows same-location navigation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });
    await screen.findByRole('radiogroup', { name: 'Can you host?' });

    const options = getLatestBlockerOptions;
    expect(hasUnsavedChanges()).toBe(false);
    expect(
      options().shouldBlockFn({
        current: { pathname: '/offer/host', search: { page: 1 } },
        next: { pathname: '/offer/host', search: { page: 1 } },
      }),
    ).toBe(false);
    expect(confirm).not.toHaveBeenCalled();

    fireEvent.change(
      screen.getByLabelText(/Tell about your home and hosting possibilities/),
      { target: { value: 'A changed hosting description.' } },
    );
    expect(hasUnsavedChanges()).toBe(true);
    expect(
      options().shouldBlockFn({
        current: { pathname: '/offer/host', search: { page: 1 } },
        next: { pathname: '/offer/host', search: { page: 1 } },
      }),
    ).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
    const navigation = {
      current: { pathname: '/offer/host', search: { page: 1 } },
      next: { pathname: '/profile/ada', search: {} },
    };
    expect(options().shouldBlockFn(navigation)).toBe(true);
    expect(confirm).toHaveBeenLastCalledWith(
      'Leave without saving your hosting offer changes?',
    );

    confirm.mockReturnValue(true);
    expect(options().shouldBlockFn(navigation)).toBe(false);
    const confirmationsBeforeSearchChange = confirm.mock.calls.length;
    expect(
      options().shouldBlockFn({
        current: { pathname: '/offer/host', search: { page: 1 } },
        next: { pathname: '/offer/host', search: { page: 2 } },
      }),
    ).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(confirmationsBeforeSearchChange + 1);
    expect(confirm).toHaveBeenLastCalledWith(
      'Leave without saving your hosting offer changes?',
    );
    confirm.mockRestore();
  });

  it('clears the unsaved-change guard when edits are reverted', async () => {
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });
    const description = await screen.findByLabelText(
      /Tell about your home and hosting possibilities/,
    );
    fireEvent.change(description, {
      target: { value: 'A changed hosting description.' },
    });
    expect(hasUnsavedChanges()).toBe(true);
    fireEvent.change(description, { target: { value: hostOffer.description } });
    expect(hasUnsavedChanges()).toBe(false);
  });

  it('resets the unsaved-change guard after saving', async () => {
    const update = vi
      .spyOn(offersApi, 'updateOffer')
      .mockResolvedValue({ message: 'Offer updated.' });
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });
    const description = await screen.findByLabelText(
      /Tell about your home and hosting possibilities/,
    );
    fireEvent.change(description, {
      target: { value: 'A saved hosting description.' },
    });
    expect(hasUnsavedChanges()).toBe(true);
    await waitFor(() => expect(update).toHaveBeenCalled());
    await waitFor(() => expect(hasUnsavedChanges()).toBe(false));
    update.mockRestore();
  });

  it('keeps the unsaved-change guard after a failed save', async () => {
    const update = vi
      .spyOn(offersApi, 'updateOffer')
      .mockRejectedValue(new Error('offline'));
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });
    const description = await screen.findByLabelText(
      /Tell about your home and hosting possibilities/,
    );
    fireEvent.change(description, {
      target: { value: 'A failed hosting update.' },
    });
    expect(hasUnsavedChanges()).toBe(true);
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'offer-1',
        expect.objectContaining({
          description: 'A failed hosting update.',
        }),
      ),
    );
    expect(hasUnsavedChanges()).toBe(true);
    update.mockRestore();
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
      screen.queryByRole('button', { name: 'Save and Exit' }),
    ).not.toBeInTheDocument();
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
          name: 'Are you open to meeting people?',
        }),
      );
      const meeting = group.getByRole('radio', { name: 'Yes' });
      expect(meeting).toBeChecked();
      fireEvent.click(group.getByRole('radio', { name: 'No' }));
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
        name: 'Are you open to meeting people?',
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
    await waitFor(() =>
      expect(offersApiMock.updateOffer).toHaveBeenCalledWith(
        'offer-1',
        expect.objectContaining({
          status: 'no',
          meetingStatus: 'yes',
          location: [52, 4],
          volunteering: false,
        }),
      ),
    );
  });

  it('explains hosting and meeting visibility together', async () => {
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });
    const meeting = within(
      await screen.findByRole('radiogroup', {
        name: 'Are you open to meeting people?',
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
    offersApiMock.createOffer.mockResolvedValue({
      message: 'Offer saved.',
      _id: 'new-host',
    });
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

    await screen.findByRole('radiogroup', { name: 'Can you host?' });

    const descriptionTextareas =
      screen.getAllByPlaceholderText('Write here...');
    fireEvent.change(descriptionTextareas[descriptionTextareas.length - 1], {
      target: { value: 'Welcome to my home.' },
    });
    expect(
      screen.queryByRole('button', { name: 'Save and Exit' }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      document.querySelector('[data-testid="location-editor"] button')!,
    );

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

  it('serialises edits made while the first offer is being created', async () => {
    let finishCreate!: (response: OfferMutationResponse) => void;
    offersApiMock.getOffers.mockResolvedValue([]);
    offersApiMock.createOffer.mockReturnValueOnce(
      new Promise(resolve => {
        finishCreate = resolve;
      }),
    );
    window.history.replaceState({}, '', '/offer/host?from=meet#location');
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

    expect(
      await screen.findByText(/Choose a location on the map to continue/),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Change location' }));
    await waitFor(() =>
      expect(offersApiMock.createOffer).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'no', location: [52, 4] }),
      ),
    );

    fireEvent.change(screen.getByLabelText(/Tell others why you cannot host/), {
      target: { value: 'I am travelling this month.' },
    });
    expect(offersApiMock.updateOffer).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('link', { name: 'Continue to meetups' }),
    ).not.toBeInTheDocument();

    await act(async () =>
      finishCreate({ message: 'Offer saved.', _id: 'new-offer' }),
    );
    expect(await screen.findByText('All changes saved')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Continue to meetups' }),
    ).toHaveAttribute('href', '/offer/meet');
    expect(offersApiMock.createOffer).toHaveBeenCalledTimes(1);
    expect(offersApiMock.updateOffer).toHaveBeenCalledWith(
      'new-offer',
      expect.objectContaining({
        noOfferDescription: 'I am travelling this month.',
      }),
    );
  });

  it('looks up the offer before retrying an uncertain create', async () => {
    offersApiMock.getOffers
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([hostOffer]);
    offersApiMock.createOffer.mockRejectedValueOnce(
      new Error('Connection lost'),
    );
    window.history.replaceState({}, '', '/offer/host?from=meet#location');
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

    fireEvent.click(
      await screen.findByRole('button', { name: 'Change location' }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('All changes saved')).toBeVisible();
    expect(offersApiMock.createOffer).toHaveBeenCalledTimes(1);
    expect(offersApiMock.updateOffer).toHaveBeenCalledWith(
      hostOffer._id,
      expect.objectContaining({ location: [52, 4] }),
    );
  });

  it.each([
    { offers: [hostOffer], outcome: 'All changes saved' },
    { offers: [], outcome: 'Could not save your hosting changes.' },
  ])(
    'looks up the ID when a create response omits it: $outcome',
    async ({ offers, outcome }) => {
      offersApiMock.getOffers
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(offers);
      offersApiMock.createOffer.mockResolvedValueOnce({
        message: 'Offer saved.',
      });
      window.history.replaceState({}, '', '/offer/host?from=meet#location');
      render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

      fireEvent.click(
        await screen.findByRole('button', { name: 'Change location' }),
      );

      expect(await screen.findByText(outcome)).toBeVisible();
      expect(offersApiMock.createOffer).toHaveBeenCalledTimes(1);
      expect(offersApiMock.getOffers).toHaveBeenCalledTimes(2);
    },
  );

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

    const hosting = await screen.findByRole('radiogroup', {
      name: 'Can you host?',
    });
    expect(within(hosting).getByRole('radio', { name: 'Maybe' })).toBeChecked();
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

    expect(screen.getByTestId('location-editor')).toHaveAttribute(
      'data-show-guide',
      'true',
    );
    expect(
      screen.getByText(/Search for a place or move the map/),
    ).toBeInTheDocument();
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
      screen.queryByRole('button', { name: 'Save and Exit' }),
    ).not.toBeInTheDocument();
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

  it('blocks form submission and autosave while the guest count is invalid', async () => {
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });
    const guests = await screen.findByRole('spinbutton', {
      name: 'How many guests can you accommodate?',
    });

    vi.useFakeTimers();
    try {
      fireEvent.change(guests, { target: { value: '100' } });
      expect(
        screen.getByText('Enter a whole number of guests from 0 to 99.'),
      ).toBeVisible();
      expect(fireEvent.submit(guests.closest('form')!)).toBe(false);
      await act(async () => vi.advanceTimersByTimeAsync(600));
      expect(offersApiMock.updateOffer).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('accepts a saved location with the default latitude and a different longitude', async () => {
    offersApiMock.getOffers.mockResolvedValue([
      { ...hostOffer, location: [DEFAULT_LOCATION.lat, 10] },
    ]);
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

    expect(await screen.findByText('All changes saved')).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Choose a location' }),
    ).not.toBeInTheDocument();
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

  it('keeps loaded availability when following a status link', async () => {
    window.history.pushState({}, '', '/offer/host?status=no');
    offersApiMock.getOffers.mockResolvedValue([hostOffer]);
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

    const hosting = await screen.findByRole('radiogroup', {
      name: 'Can you host?',
    });
    expect(within(hosting).getByRole('radio', { name: 'Yes' })).toBeChecked();
    expect(offersApiMock.updateOffer).not.toHaveBeenCalled();
  });

  it('does not submit when the description is too short', async () => {
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

    await screen.findByRole('radiogroup', { name: 'Can you host?' });
    const descriptionTextareas =
      screen.getAllByPlaceholderText('Write here...');
    fireEvent.change(descriptionTextareas[descriptionTextareas.length - 1], {
      target: { value: 'Hi' },
    });

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

  it('allows a new host to choose a location and publish automatically', async () => {
    offersApiMock.getOffers.mockResolvedValue([]);
    render(<OfferHostPage user={user} />, { wrapper: analytics.wrapper });

    await screen.findByRole('radiogroup', { name: 'Can you host?' });
    fireEvent.change(screen.getByPlaceholderText('Write here...'), {
      target: { value: 'A welcoming place to stay.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Change location' }));
    expect(await screen.findByText('All changes saved')).toBeVisible();
  });
});
