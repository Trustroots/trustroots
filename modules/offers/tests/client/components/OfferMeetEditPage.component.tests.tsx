import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import OfferMeetEditPage from '@/modules/offers/client/components/OfferMeetEditPage.component';
import * as offersApi from '@/modules/offers/client/api/offers.api';
import type { Offer } from '@/modules/offers/client/api/offers.api';
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

describe('OfferMeetEditPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getCurrentRouteParamsMock.mockReturnValue({});
  });

  it('keeps an empty expiry editable and prevents saving until it is valid', async () => {
    offersApiMock.createOffer.mockResolvedValue({});
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
    offersApiMock.createOffer.mockResolvedValue({});
    render(<OfferMeetEditPage user={{ _id: 'user-1' }} />);

    fireEvent.change(await screen.findByPlaceholderText('Write here...'), {
      target: { value: 'Coffee in the park.' },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Location' }));
    expect(await screen.findByTestId('location-editor')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Finish editing and save' }),
    );

    await waitFor(() => {
      expect(offersApiMock.createOffer).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Coffee in the park.',
          type: 'meet',
        }),
      );
    });
  });

  it('loads and updates an existing meet offer', async () => {
    getCurrentRouteParamsMock.mockReturnValue({ offerId: 'offer-1' });
    offersApiMock.getOffer.mockResolvedValue({
      description: 'Existing meet.',
      location: [51.5, -0.12],
      validUntil: new Date(Date.now() + 86400000).toISOString(),
    });
    offersApiMock.updateOffer.mockResolvedValue({});

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
      validUntil: new Date(Date.now() + 86400000).toISOString(),
    });

    render(<OfferMeetEditPage user={{ _id: 'user-1' }} />);

    expect(await screen.findByPlaceholderText('Write here...')).toHaveValue('');
    fireEvent.click(screen.getByRole('tab', { name: 'Location' }));
    expect(await screen.findByTestId('location-editor')).toBeInTheDocument();
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
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => {
      expect(offersApiMock.createOffer).toHaveBeenCalled();
    });
    expect(screen.getByText('What is this about?')).toBeInTheDocument();
  });

  it('ignores loaded meet offers after unmounting', async () => {
    getCurrentRouteParamsMock.mockReturnValue({ offerId: 'offer-1' });

    let resolveOffer!: (offer: Offer) => void;
    offersApiMock.getOffer.mockReturnValue(
      new Promise<Offer>(resolve => {
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
    getCurrentRouteParamsMock.mockReturnValue({
      offerId: 'offer-without-expiry',
    });
    offersApiMock.getOffer.mockResolvedValue({
      _id: 'offer-without-expiry',
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
      new Promise<Offer>((resolve, reject) => {
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
