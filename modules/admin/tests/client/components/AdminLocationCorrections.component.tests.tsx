import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminLocationCorrections from '@/modules/admin/client/components/AdminLocationCorrections.component';
import * as api from '@/modules/admin/client/api/location-corrections.api';
import type {
  LocationCorrectionCandidate,
  LocationCorrectionSendResult,
} from '@/modules/admin/client/api/location-corrections.api';

jest.mock('@/modules/admin/client/api/location-corrections.api');
jest.mock(
  '@/modules/admin/client/components/AdminHeader.component',
  () =>
    function MockAdminHeader() {
      return <nav>Welcome team</nav>;
    },
);

const apiMock = jest.mocked(api);

const candidates: LocationCorrectionCandidate[] = [
  {
    userId: 'member-1',
    username: 'alex',
    displayName: 'Alex',
    key: 'exact-key',
    match: 'exact',
    offers: [
      {
        _id: 'offer-1',
        type: 'host',
        location: [48.6908333333, 9.14055555556],
      },
    ],
  },
  {
    userId: 'member-2',
    username: 'sam',
    displayName: 'Sam',
    key: 'nearby-key',
    match: 'nearby',
    offers: [{ _id: 'offer-2', type: 'meet', location: [48.691, 9.141] }],
  },
];

describe('AdminLocationCorrections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiMock.getLocationCorrections.mockResolvedValue(candidates);
    apiMock.sendLocationCorrection.mockResolvedValue({ sent: true });
  });

  it('reviews exact and nearby candidates and sends an edited message', async () => {
    render(<AdminLocationCorrections />);
    expect(
      await screen.findByText('Exact default location'),
    ).toBeInTheDocument();
    expect(screen.getByText('Nearby for review')).toBeInTheDocument();
    expect(screen.getByText('2 users awaiting review')).toBeInTheDocument();
    expect(apiMock.sendLocationCorrection).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Review alex' }));
    expect(
      within(screen.getByRole('dialog', { name: 'Review Alex' })).getByText(
        'Exact default location',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Message from your account')).toHaveFocus();
    expect(screen.getByRole('link', { name: 'View offer' })).toHaveAttribute(
      'href',
      '/search?offer=offer-1',
    );
    fireEvent.change(screen.getByLabelText('Message from your account'), {
      target: { value: 'Please check your hosting location.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() =>
      expect(apiMock.sendLocationCorrection).toHaveBeenCalledWith(
        'member-1',
        'exact-key',
        'Please check your hosting location.',
      ),
    );
    expect(
      await screen.findByText('Message sent to Alex.'),
    ).toBeInTheDocument();
    expect(screen.getByText('1 user awaiting review')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Review alex' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Review sam' }),
    ).toBeInTheDocument();
  });

  it('keeps a candidate available after a failed send', async () => {
    apiMock.sendLocationCorrection.mockRejectedValue({
      response: { data: { message: 'Candidate changed.' } },
    });
    render(<AdminLocationCorrections />);
    fireEvent.click(await screen.findByRole('button', { name: 'Review sam' }));
    expect(
      screen.getByText('Nearby location: verify before contacting'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Candidate changed.',
    );
    expect(
      screen.getByRole('button', { name: 'Review sam' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('refreshes the queue when a candidate changes before sending', async () => {
    apiMock.sendLocationCorrection.mockRejectedValue({
      response: { status: 409, data: { message: 'Candidate changed.' } },
    });
    apiMock.getLocationCorrections.mockResolvedValueOnce(candidates);
    apiMock.getLocationCorrections.mockResolvedValueOnce([candidates[1]]);
    render(<AdminLocationCorrections />);
    fireEvent.click(await screen.findByRole('button', { name: 'Review alex' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Candidate changed.',
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Review alex' }),
      ).not.toBeInTheDocument(),
    );
    expect(apiMock.getLocationCorrections).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole('button', { name: 'Review sam' }),
    ).toBeInTheDocument();
  });

  it('reports when a stale queue cannot be refreshed', async () => {
    apiMock.sendLocationCorrection.mockRejectedValue({
      response: { status: 409 },
    });
    apiMock.getLocationCorrections.mockResolvedValueOnce(candidates);
    apiMock.getLocationCorrections.mockRejectedValueOnce(new Error('offline'));
    render(<AdminLocationCorrections />);
    fireEvent.click(await screen.findByRole('button', { name: 'Review alex' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not refresh location corrections.',
    );
  });

  it('shows loading failures and an empty queue', async () => {
    apiMock.getLocationCorrections.mockRejectedValueOnce(new Error('offline'));
    const first = render(<AdminLocationCorrections />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load location corrections.',
    );
    first.unmount();

    apiMock.getLocationCorrections.mockResolvedValueOnce([]);
    render(<AdminLocationCorrections />);
    expect(
      await screen.findByText('No uncontacted candidates found.'),
    ).toBeInTheDocument();
  });

  it('shows a shared contact result and supports members without a display name', async () => {
    apiMock.getLocationCorrections.mockResolvedValueOnce([
      {
        ...candidates[1],
        displayName: '',
        offers: [
          ...candidates[1].offers,
          { _id: 'offer-3', type: 'host', location: [48.692, 9.142] },
        ],
      },
    ]);
    apiMock.sendLocationCorrection.mockResolvedValueOnce({ sent: false });
    render(<AdminLocationCorrections />);
    fireEvent.click(await screen.findByRole('button', { name: 'Review sam' }));
    expect(screen.getByText('2 offers', { exact: false })).toBeInTheDocument();
    const message = screen.getByLabelText(
      'Message from your account',
    ) as HTMLTextAreaElement;
    expect(message.value).toContain('/offer/meet/offer-2');
    expect(message.value).toContain('/offer/host');
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'sam has already been contacted.',
    );
  });

  it('uses the username in a sent confirmation when no display name exists', async () => {
    apiMock.getLocationCorrections.mockResolvedValueOnce([
      { ...candidates[0], displayName: '' },
    ]);
    render(<AdminLocationCorrections />);
    fireEvent.click(await screen.findByRole('button', { name: 'Review alex' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Message sent to alex.',
    );
  });

  it('prevents blank and duplicate submissions and reports unlabelled failures', async () => {
    let finishSend!: (error: Error) => void;
    apiMock.sendLocationCorrection.mockImplementationOnce(
      () =>
        new Promise<LocationCorrectionSendResult>((_resolve, reject) => {
          finishSend = reject;
        }),
    );
    render(<AdminLocationCorrections />);
    fireEvent.click(await screen.findByRole('button', { name: 'Review alex' }));
    fireEvent.change(screen.getByLabelText('Message from your account'), {
      target: { value: '   ' },
    });
    fireEvent.submit(getMessageForm());
    expect(apiMock.sendLocationCorrection).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Message from your account'), {
      target: { value: 'A useful correction.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.submit(getMessageForm());
    expect(apiMock.sendLocationCorrection).toHaveBeenCalledTimes(1);
    finishSend(new Error('offline'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not send the message.',
    );
  });

  it('closes the review dialog with Escape and restores focus to Review', async () => {
    render(<AdminLocationCorrections />);
    const review = await screen.findByRole('button', { name: 'Review alex' });
    review.focus();
    fireEvent.click(review);
    const dialog = screen.getByRole('dialog', { name: 'Review Alex' });
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape', keyCode: 27 });
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(review).toHaveFocus();
    expect(apiMock.sendLocationCorrection).not.toHaveBeenCalled();
  });

  it('ignores a late queue response after unmounting', async () => {
    let finishLoad!: (candidates: LocationCorrectionCandidate[]) => void;
    apiMock.getLocationCorrections.mockImplementationOnce(
      () =>
        new Promise<LocationCorrectionCandidate[]>(resolve => {
          finishLoad = resolve;
        }),
    );
    const first = render(<AdminLocationCorrections />);
    first.unmount();
    finishLoad(candidates);
    await Promise.resolve();

    apiMock.getLocationCorrections.mockRejectedValueOnce(new Error('offline'));
    const second = render(<AdminLocationCorrections />);
    second.unmount();
    await Promise.resolve();
  });
});

function getMessageForm(): HTMLFormElement {
  const form = screen
    .getByLabelText('Message from your account')
    .closest('form');
  if (!form) {
    throw new Error('Expected the message editor to be inside a form.');
  }
  return form;
}
