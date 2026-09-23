import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminLocationCorrections from '@/modules/admin/client/components/AdminLocationCorrections.component';
import * as api from '@/modules/admin/client/api/location-corrections.api';

jest.mock('@/modules/admin/client/api/location-corrections.api');
jest.mock(
  '@/modules/admin/client/components/AdminHeader.component',
  () =>
    function MockAdminHeader() {
      return <nav>Welcome team</nav>;
    },
);

const candidates = [
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
    api.getLocationCorrections.mockResolvedValue(candidates);
    api.sendLocationCorrection.mockResolvedValue({ sent: true });
  });

  it('reviews exact and nearby candidates and sends an edited message', async () => {
    render(<AdminLocationCorrections />);
    expect(await screen.findByText('Exact former default')).toBeInTheDocument();
    expect(screen.getByText('Nearby for review')).toBeInTheDocument();
    expect(api.sendLocationCorrection).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Review alex' }));
    expect(
      screen.getByText('Exact former default location'),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Message from your account'), {
      target: { value: 'Please check your hosting location.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() =>
      expect(api.sendLocationCorrection).toHaveBeenCalledWith(
        'member-1',
        'exact-key',
        'Please check your hosting location.',
      ),
    );
    expect(
      await screen.findByText('Message sent to Alex.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Review alex' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Review sam' }),
    ).toBeInTheDocument();
  });

  it('keeps a candidate available after a failed send', async () => {
    api.sendLocationCorrection.mockRejectedValue({
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

  it('shows loading failures and an empty queue', async () => {
    api.getLocationCorrections.mockRejectedValueOnce(new Error('offline'));
    const first = render(<AdminLocationCorrections />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load location corrections.',
    );
    first.unmount();

    api.getLocationCorrections.mockResolvedValueOnce([]);
    render(<AdminLocationCorrections />);
    expect(
      await screen.findByText('No uncontacted candidates found.'),
    ).toBeInTheDocument();
  });

  it('shows a shared contact result and supports members without a display name', async () => {
    api.getLocationCorrections.mockResolvedValueOnce([
      {
        ...candidates[1],
        displayName: '',
        offers: [
          ...candidates[1].offers,
          { _id: 'offer-3', type: 'host', location: [48.692, 9.142] },
        ],
      },
    ]);
    api.sendLocationCorrection.mockResolvedValueOnce({ sent: false });
    render(<AdminLocationCorrections />);
    fireEvent.click(await screen.findByRole('button', { name: 'Review sam' }));
    expect(screen.getByText('2 offers', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('Message from your account').value).toContain(
      '/offer/meet/offer-2',
    );
    expect(screen.getByLabelText('Message from your account').value).toContain(
      '/offer/host',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'sam has already been contacted.',
    );
  });

  it('uses the username in a sent confirmation when no display name exists', async () => {
    api.getLocationCorrections.mockResolvedValueOnce([
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
    let finishSend;
    api.sendLocationCorrection.mockImplementationOnce(
      () =>
        new Promise((resolve, reject) => {
          finishSend = reject;
        }),
    );
    render(<AdminLocationCorrections />);
    fireEvent.click(await screen.findByRole('button', { name: 'Review alex' }));
    fireEvent.change(screen.getByLabelText('Message from your account'), {
      target: { value: '   ' },
    });
    fireEvent.submit(
      screen.getByLabelText('Message from your account').closest('form'),
    );
    expect(api.sendLocationCorrection).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Message from your account'), {
      target: { value: 'A useful correction.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    fireEvent.submit(
      screen.getByLabelText('Message from your account').closest('form'),
    );
    expect(api.sendLocationCorrection).toHaveBeenCalledTimes(1);
    finishSend(new Error('offline'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not send the message.',
    );
  });

  it('ignores a late queue response after unmounting', async () => {
    let finishLoad;
    api.getLocationCorrections.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishLoad = resolve;
        }),
    );
    const first = render(<AdminLocationCorrections />);
    first.unmount();
    finishLoad(candidates);
    await Promise.resolve();

    api.getLocationCorrections.mockRejectedValueOnce(new Error('offline'));
    const second = render(<AdminLocationCorrections />);
    second.unmount();
    await Promise.resolve();
  });
});
