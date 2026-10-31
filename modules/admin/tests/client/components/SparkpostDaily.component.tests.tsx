import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Daily from '@/modules/admin/client/components/SparkpostDaily.component';
import * as api from '@/modules/admin/client/api/sparkpost.api';
jest.mock('@/modules/admin/client/api/sparkpost.api');
const mocked = jest.mocked(api);
const candidate = {
  key: 'signup:sample',
  kind: 'signup' as const,
  username: 'sample-member',
  recipient: 'member@example.test',
  description: 'Fresh sign-up confirmation',
};
beforeEach(() => {
  mocked.getSparkpostEvents.mockResolvedValue({
    date: '2026-10-30',
    capped: false,
    events: [],
  });
  mocked.getRecoveryDay.mockResolvedValue({
    page: 1,
    more: false,
    candidates: [candidate],
  });
});
afterEach(() => jest.resetAllMocks());
it('groups message events across pages and links the recipient account', async () => {
  const event = {
    messageId: 'mail-1',
    timestamp: '2026-10-30T12:00:00Z',
    type: 'injection',
    campaign: 'confirm-email',
    recipient: 'member@example.test',
    recipientDomain: 'example.test',
    subject: 'Confirm your email',
    account: {
      username: 'sample-member',
      created: '2026-10-28T00:00:00Z',
      public: false,
    },
  };
  mocked.getSparkpostEvents
    .mockResolvedValueOnce({
      date: '2026-10-30',
      capped: false,
      nextCursor: 'next',
      events: [event],
    })
    .mockResolvedValueOnce({
      date: '2026-10-30',
      capped: false,
      events: [{ ...event, type: 'delivery' }],
    });
  render(<Daily date="2026-10-30" />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Load more events' }),
  );
  await screen.findByText('injection, delivery');
  expect(screen.getAllByText('Confirm your email')).toHaveLength(1);
  expect(mocked.getSparkpostEvents).toHaveBeenLastCalledWith(
    '2026-10-30',
    'next',
  );
});
it('selects all displayed eligible events, reviews recipients and reports queue results', async () => {
  mocked.sendRecovery.mockResolvedValue({
    results: [{ key: candidate.key, status: 'Queued for delivery' }],
  });
  render(<Daily date="2026-10-30" />);
  fireEvent.click(
    await screen.findByLabelText('Select all eligible events on this page'),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Review 1 selected emails' }),
  );
  expect(
    screen.getByRole('region', { name: 'Review recovery emails' }),
  ).toHaveTextContent('member@example.test');
  fireEvent.click(
    screen.getByRole('button', { name: 'Queue selected emails' }),
  );
  await screen.findByText(/Queued for delivery/);
  expect(mocked.sendRecovery).toHaveBeenCalledWith('2026-10-30', [
    candidate.key,
  ]);
  expect(
    screen.getByLabelText(
      'Select Fresh sign-up confirmation for sample-member',
    ),
  ).toBeDisabled();
});
it('keeps completed recoveries unselectable and handles request errors visibly', async () => {
  mocked.getSparkpostEvents.mockRejectedValue(new Error('provider'));
  mocked.getRecoveryDay.mockResolvedValue({
    page: 1,
    more: true,
    candidates: [{ ...candidate, status: 'queued' }],
  });
  render(<Daily date="2026-10-30" />);
  await screen.findByText('queued');
  expect(
    screen.getByLabelText('Select all eligible events on this page'),
  ).toBeDisabled();
  await screen.findByText(/Could not load provider/);
  fireEvent.click(screen.getByRole('button', { name: 'Next candidates' }));
  await waitFor(() =>
    expect(mocked.getRecoveryDay).toHaveBeenLastCalledWith('2026-10-30', 2),
  );
});

it('handles individual selection, cancel, uncertain sends and paging without assuming delivery', async () => {
  mocked.getSparkpostEvents.mockResolvedValue({
    date: '2026-10-30',
    capped: true,
    events: [
      { timestamp: '123', type: 'open', recipientDomain: '', campaign: '' },
      {
        timestamp: '123',
        type: 'bounce',
        recipientDomain: 'example.test',
        campaign: '',
        account: {
          username: 'confirmed',
          created: '2026-10-01T00:00:00Z',
          public: true,
        },
      },
    ],
  });
  mocked.getRecoveryDay.mockResolvedValue({
    page: 1,
    more: true,
    candidates: [candidate],
  });
  mocked.sendRecovery.mockRejectedValue(new Error('uncertain'));
  render(<Daily date="2026-10-30" />);
  await screen.findByText('No unique current account match');
  expect(screen.getAllByText('Not supplied').length).toBeGreaterThan(0);
  const select = screen.getByLabelText(
    'Select Fresh sign-up confirmation for sample-member',
  );
  fireEvent.click(select);
  fireEvent.click(select);
  const all = screen.getByLabelText('Select all eligible events on this page');
  fireEvent.click(all);
  fireEvent.click(all);
  fireEvent.click(all);
  fireEvent.click(
    screen.getByRole('button', { name: 'Review 1 selected emails' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Review 1 selected emails' }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Queue selected emails' }),
  );
  await screen.findByText(/Outcome unavailable/);
  fireEvent.click(screen.getByRole('button', { name: 'Next candidates' }));
  await waitFor(() =>
    expect(mocked.getRecoveryDay).toHaveBeenLastCalledWith('2026-10-30', 2),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Previous candidates' }));
  await waitFor(() =>
    expect(mocked.getRecoveryDay).toHaveBeenLastCalledWith('2026-10-30', 1),
  );
});
it('shows failed candidate loads', async () => {
  mocked.getRecoveryDay.mockRejectedValue(new Error('failed'));
  render(<Daily date="2026-10-30" />);
  await screen.findByText('Could not load recovery candidates.');
});

it.each(['resolve', 'reject'] as const)(
  'ignores late %s after leaving the day',
  async outcome => {
    let finishEvents!: (
      value: import('@/modules/admin/shared/sparkpost').SparkpostEvents,
    ) => void;
    let failEvents!: (error: Error) => void;
    let finishDay!: (
      value: import('@/modules/admin/shared/sparkpost').RecoveryDay,
    ) => void;
    let failDay!: (error: Error) => void;
    mocked.getSparkpostEvents.mockReturnValue(
      new Promise((yes, no) => {
        finishEvents = yes;
        failEvents = no;
      }),
    );
    mocked.getRecoveryDay.mockReturnValue(
      new Promise((yes, no) => {
        finishDay = yes;
        failDay = no;
      }),
    );
    const view = render(<Daily date="2026-10-30" />);
    view.unmount();
    if (outcome === 'resolve') {
      finishEvents({ date: '2026-10-30', capped: false, events: [] });
      finishDay({ page: 1, more: false, candidates: [] });
    } else {
      failEvents(new Error('late'));
      failDay(new Error('late'));
    }
    await Promise.resolve();
  },
);
it('shows an empty application page and preserves an unexpected result identifier', async () => {
  mocked.getRecoveryDay.mockResolvedValueOnce({
    page: 1,
    more: false,
    candidates: [],
  });
  const view = render(<Daily date="2026-10-30" />);
  await screen.findByText('No eligible application events on this page.');
  view.unmount();
  mocked.sendRecovery.mockResolvedValue({
    results: [{ key: 'unexpected-result', status: 'Skipped' }],
  });
  render(<Daily date="2026-10-30" />);
  fireEvent.click(
    await screen.findByLabelText('Select all eligible events on this page'),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Review 1 selected emails' }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Queue selected emails' }),
  );
  await screen.findByText('unexpected-result: Skipped');
});
