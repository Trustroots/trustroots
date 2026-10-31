import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SignupRecovery from '@/modules/admin/client/components/SignupRecovery.component';
import * as api from '@/modules/admin/client/api/sparkpost.api';
jest.mock('@/modules/admin/client/api/sparkpost.api');
const mocked = jest.mocked(api);
afterEach(() => jest.resetAllMocks());
it('shows accounts behind the count and queues reviewed confirmations by their sign-up day', async () => {
  mocked.getRecoveryAccounts.mockResolvedValue({
    page: 1,
    more: false,
    candidates: [
      {
        key: 'signup:sample',
        kind: 'signup',
        username: 'sample-member',
        recipient: 'member@example.test',
        created: '2026-10-30T12:00:00Z',
        description: 'Fresh sign-up confirmation',
      },
    ],
  });
  mocked.sendRecovery.mockResolvedValue({
    results: [{ key: 'signup:sample', status: 'Queued for delivery' }],
  });
  render(
    <SignupRecovery from="2026-10-28T00:00:00Z" to="2026-10-31T12:00:00Z" />,
  );
  fireEvent.click(
    await screen.findByLabelText('Select all eligible accounts on this page'),
  );
  expect(screen.getByText('2026-10-30 12:00')).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Review 1 confirmations' }),
  );
  expect(
    screen.getByRole('region', { name: 'Review confirmations' }),
  ).toHaveTextContent('member@example.test');
  fireEvent.click(
    screen.getByRole('button', { name: 'Queue confirmation emails' }),
  );
  await screen.findByText(/Queued for delivery/);
  expect(mocked.sendRecovery).toHaveBeenCalledWith('2026-10-30', [
    'signup:sample',
  ]);
});

it('supports individual selection, cancellation, paging and uncertain queue outcomes', async () => {
  const row = {
    key: 'signup:one',
    kind: 'signup' as const,
    username: 'one',
    recipient: 'one@example.test',
    created: '2026-10-30T12:00:00Z',
    description: 'Confirmation',
  };
  mocked.getRecoveryAccounts.mockResolvedValue({
    page: 1,
    more: true,
    candidates: [
      row,
      { ...row, key: 'signup:two', username: 'two' },
      {
        ...row,
        key: 'signup:old',
        username: 'old',
        status: 'queued',
        created: undefined,
      },
    ],
  });
  mocked.sendRecovery.mockRejectedValue(new Error('uncertain'));
  render(<SignupRecovery from="start" to="end" />);
  const select = await screen.findByLabelText('Select confirmation for one');
  fireEvent.click(select);
  fireEvent.click(select);
  const all = screen.getByLabelText(
    'Select all eligible accounts on this page',
  );
  fireEvent.click(all);
  fireEvent.click(all);
  fireEvent.click(all);
  fireEvent.click(
    screen.getByRole('button', { name: 'Review 2 confirmations' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Review 2 confirmations' }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Queue confirmation emails' }),
  );
  await screen.findAllByText(/Outcome unavailable/);
  fireEvent.click(screen.getByRole('button', { name: 'Next accounts' }));
  await screen.findByText(/Page 2/);
  fireEvent.click(screen.getByRole('button', { name: 'Previous accounts' }));
  await screen.findByText(/Page 1/);
});
it('shows empty and failed account loads', async () => {
  mocked.getRecoveryAccounts
    .mockResolvedValueOnce({ page: 1, more: false, candidates: [] })
    .mockRejectedValueOnce(new Error('failed'));
  const view = render(<SignupRecovery from="start" to="end" />);
  await screen.findByText('No eligible unconfirmed accounts in this range.');
  view.rerender(<SignupRecovery from="changed" to="end" />);
  await screen.findByRole('alert');
});

it.each(['resolve', 'reject'] as const)(
  'ignores late account %s after leaving the list',
  async outcome => {
    let finish!: (
      value: import('@/modules/admin/shared/sparkpost').RecoveryDay,
    ) => void;
    let fail!: (error: Error) => void;
    mocked.getRecoveryAccounts.mockReturnValue(
      new Promise((yes, no) => {
        finish = yes;
        fail = no;
      }),
    );
    const view = render(<SignupRecovery from="start" to="end" />);
    view.unmount();
    if (outcome === 'resolve') finish({ page: 1, more: false, candidates: [] });
    else fail(new Error('late'));
    await Promise.resolve();
  },
);
