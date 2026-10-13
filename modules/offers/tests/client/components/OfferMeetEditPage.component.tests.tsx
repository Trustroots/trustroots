import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import OfferMeetEditPage from '@/modules/offers/client/components/OfferMeetEditPage.component';
import * as offersApi from '@/modules/offers/client/api/offers.api';
import type { OfferReadPayload } from '@/modules/offers/shared/offer';
import type { TabsProps } from 'react-bootstrap';
import type OfferLocationEditor from '@/modules/offers/client/components/OfferLocationEditor.component';
import { getCurrentRouteParams } from '@/modules/core/client/services/client-runtime';

const offersApiMock = jest.mocked(offersApi);
const getCurrentRouteParamsMock = jest.mocked(getCurrentRouteParams);

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
    default: ({
      location,
      onLocationChange,
    }: React.ComponentProps<typeof OfferLocationEditor>) => (
      <div
        data-testid="location-editor"
        data-location={location?.join(',') ?? ''}
      >
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
    getCurrentRouteParamsMock.mockReturnValue({});
  });

  it('keeps an empty expiry editable and prevents saving until it is valid', async () => {
    offersApiMock.createOffer.mockResolvedValue({ message: 'Offer saved.' });
    render(<OfferMeetEditPage user={{ _id: 'member-1' }} />);
    const expiry = await screen.findByLabelText(
      'How long should this be visible?',
    );
    fireEvent.change(screen.getByPlaceholderText('Write here...'), {
      target: { value: 'Meet for a walk.' },
    });
    fireEvent.change(expiry, { target: { value: '' } });
    expect(expiry).toHaveValue('');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Please choose a valid expiry date.',
    );
    fireEvent.submit(document.querySelector('form')!);
    expect(offersApiMock.createOffer).not.toHaveBeenCalled();
    const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    fireEvent.change(expiry, { target: { value: date } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Location' }));
    fireEvent.click(
      document.querySelector('[data-testid="location-editor"] button')!,
    );
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() =>
      expect(offersApiMock.createOffer).toHaveBeenCalledWith(
        expect.objectContaining({ validUntil: new Date(date).toISOString() }),
      ),
    );
  });

  it('renders a new meet offer form', async () => {
    render(<OfferMeetEditPage user={{ _id: 'user-1' }} />);

    expect(await screen.findByText('What is this about?')).toBeVisible();
    expect(screen.getByText('Meets explanation')).toBeInTheDocument();
    expect(
      screen.getByLabelText('How long should this be visible?'),
    ).toBeInTheDocument();
  });

  it('keeps the active tab when selection is cleared', async () => {
    render(<OfferMeetEditPage user={{ _id: 'user-1' }} />);

    expect(await screen.findByText('What is this about?')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Clear selected tab' }));

    expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('creates a new meet offer after filling details', async () => {
    offersApiMock.createOffer.mockResolvedValue({ message: 'Offer saved.' });
    render(<OfferMeetEditPage user={{ _id: 'user-1' }} />);

    fireEvent.change(await screen.findByPlaceholderText('Write here...'), {
      target: { value: 'Coffee in the park.' },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Location' }));
    expect(await screen.findByTestId('location-editor')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Finish editing and save' }),
    ).toBeDisabled();
    fireEvent.submit(document.querySelector('form')!);
    expect(offersApiMock.createOffer).not.toHaveBeenCalled();
    fireEvent.click(
      document.querySelector('[data-testid="location-editor"] button')!,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Finish editing and save' }),
    );

    await waitFor(() => {
      expect(offersApiMock.createOffer).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Coffee in the park.',
          type: 'meet',
          location: [52, 4],
        }),
      );
    });
  });

  it('loads and updates an existing meet offer', async () => {
    getCurrentRouteParamsMock.mockReturnValue({ offerId: 'offer-1' });
    offersApiMock.getOffer.mockResolvedValue({
      _id: 'offer-1',
      type: 'meet',
      user: { _id: 'user-1', username: 'fictional-user' },
      description: 'Existing meet.',
      location: [51.5, -0.12],
      validUntil: new Date(Date.now() + 86400000).toISOString(),
    });
    offersApiMock.updateOffer.mockResolvedValue({ message: 'Offer updated.' });

    render(<OfferMeetEditPage user={{ _id: 'user-1' }} />);

    fireEvent.change(await screen.findByPlaceholderText('Write here...'), {
      target: { value: 'Updated meet description.' },
    });
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => {
      expect(offersApiMock.updateOffer).toHaveBeenCalledWith(
        'offer-1',
        expect.objectContaining({
          description: 'Updated meet description.',
        }),
      );
    });
  });

  it('fills missing description and location on a legacy offer', async () => {
    getCurrentRouteParamsMock.mockReturnValue({ offerId: 'legacy-offer' });
    offersApiMock.getOffer.mockResolvedValue({
      _id: 'legacy-offer',
      type: 'meet',
      user: { _id: 'user-1', username: 'fictional-user' },
      location: [0, 0],
      validUntil: new Date(Date.now() + 86400000).toISOString(),
    });

    render(<OfferMeetEditPage user={{ _id: 'user-1' }} />);

    expect(await screen.findByPlaceholderText('Write here...')).toHaveValue('');
    fireEvent.click(screen.getByRole('tab', { name: 'Location' }));
    expect(await screen.findByTestId('location-editor')).toBeInTheDocument();
  });

  it('uses the default location when a legacy offer has no location', async () => {
    getCurrentRouteParamsMock.mockReturnValue({ offerId: 'legacy-offer' });
    const legacyOffer = {
      _id: 'legacy-offer',
      type: 'meet',
      user: { _id: 'user-1', username: 'fictional-user' },
      description: 'Coffee in the park.',
      validUntil: new Date(Date.now() + 86400000).toISOString(),
    };
    Reflect.apply(
      offersApiMock.getOffer.mockResolvedValueOnce,
      offersApiMock.getOffer,
      [legacyOffer],
    );

    render(<OfferMeetEditPage user={{ _id: 'user-1' }} />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Location' }));
    expect(await screen.findByTestId('location-editor')).toHaveAttribute(
      'data-location',
      '48.6908333333,9.14055555556',
    );
  });

  it('falls back to the route id when a loaded legacy offer lacks its id', async () => {
    getCurrentRouteParamsMock.mockReturnValue({ offerId: 'route-offer' });
    const legacyOffer = {
      type: 'meet',
      user: { _id: 'user-1', username: 'fictional-user' },
      description: 'Coffee in the park.',
      location: [51.5, -0.12],
      validUntil: new Date(Date.now() + 86400000).toISOString(),
    };
    Reflect.apply(
      offersApiMock.getOffer.mockResolvedValueOnce,
      offersApiMock.getOffer,
      [legacyOffer],
    );
    offersApiMock.updateOffer.mockResolvedValue({ message: 'Offer updated.' });

    render(<OfferMeetEditPage user={{ _id: 'user-1' }} />);
    await screen.findByPlaceholderText('Write here...');
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => {
      expect(offersApiMock.updateOffer).toHaveBeenCalledWith(
        'route-offer',
        expect.objectContaining({ description: 'Coffee in the park.' }),
      );
    });
  });

  it('keeps loading when an existing meet offer cannot be loaded', async () => {
    getCurrentRouteParamsMock.mockReturnValue({ offerId: 'missing-offer' });
    offersApiMock.getOffer.mockRejectedValue(new Error('not found'));

    render(<OfferMeetEditPage user={{ _id: 'user-1' }} />);

    expect(await screen.findByText('Wait a moment…')).toBeInTheDocument();
  });

  it('stays on the form when saving a new meet offer fails', async () => {
    offersApiMock.createOffer.mockRejectedValue(new Error('save failed'));
    render(<OfferMeetEditPage user={{ _id: 'user-1' }} />);

    fireEvent.change(await screen.findByPlaceholderText('Write here...'), {
      target: { value: 'Coffee in the park.' },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Location' }));
    fireEvent.click(
      document.querySelector('[data-testid="location-editor"] button')!,
    );
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => {
      expect(offersApiMock.createOffer).toHaveBeenCalled();
    });
    expect(screen.getByText('What is this about?')).toBeInTheDocument();
  });

  it('ignores loaded meet offers after unmounting', async () => {
    getCurrentRouteParamsMock.mockReturnValue({ offerId: 'offer-1' });

    let resolveOffer!: (offer: OfferReadPayload) => void;
    offersApiMock.getOffer.mockReturnValue(
      new Promise<OfferReadPayload>(resolve => {
        resolveOffer = resolve;
      }),
    );

    const { unmount } = render(<OfferMeetEditPage user={{ _id: 'user-1' }} />);
    unmount();
    resolveOffer({
      _id: 'offer-1',
      type: 'meet',
      user: { _id: 'user-1', username: 'fictional-user' },
      description: 'Late offer.',
      location: [51.5, -0.12],
      validUntil: new Date(Date.now() + 86400000).toISOString(),
    });
    await new Promise(resolve => setTimeout(resolve, 20));
  });

  it('uses a default expiry date for loaded meet offers without one', async () => {
    getCurrentRouteParamsMock.mockReturnValue({
      offerId: 'offer-without-expiry',
    });
    offersApiMock.getOffer.mockResolvedValue({
      _id: 'offer-without-expiry',
      type: 'meet',
      user: { _id: 'user-1', username: 'fictional-user' },
      description: 'Coffee in the park.',
      location: [51.5, -0.12],
    });

    render(<OfferMeetEditPage user={{ _id: 'user-1' }} />);

    expect(
      (
        (await screen.findByLabelText(
          'How long should this be visible?',
        )) as HTMLInputElement
      ).value,
    ).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('ignores failed meet offer loads after unmounting', async () => {
    getCurrentRouteParamsMock.mockReturnValue({ offerId: 'offer-1' });

    let rejectOffer!: (error: Error) => void;
    offersApiMock.getOffer.mockReturnValue(
      new Promise<OfferReadPayload>((resolve, reject) => {
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
    fireEvent.submit(document.querySelector('form')!);

    expect(offersApiMock.createOffer).not.toHaveBeenCalled();
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
      document.querySelector('[data-testid="location-editor"] button')!,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Previous section' }));
    expect(screen.getByText('What is this about?')).toBeVisible();
  });
});
