import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminSpamCleanup from '../../../client/components/AdminSpamCleanup';
import http from '../../../../core/client/api/http-client';
jest.mock(
  '../../../client/components/AdminHeader.component',
  () =>
    function Header() {
      return <nav>Admin</nav>;
    },
);
jest.mock('../../../../core/client/api/http-client', () => ({
  __esModule: true,
  default: { post: jest.fn() },
  getErrorMessage: (_error: unknown, fallback: string) => fallback,
}));
const post = jest.mocked(http.post);
const one = {
  id: 'one',
  username: 'fictional/spammer',
  created: '2021-07-04T12:00:00Z',
  eligible: true,
  stage: 'inactive' as const,
  lastSeen: '2023-12-31T23:59:59Z',
};
const batch = {
  previewId: 'fictional-preview',
  expiresAt: '2030-01-01T00:00:00Z',
  building: false,
  candidates: 102,
  eligible: 101,
  protected: 1,
  inactive: 100,
  review: 1,
  unknownLogin: 1,
  inactiveBefore: '2024-01-01T00:00:00.000Z',
  page: 1,
  pages: 2,
  items: [
    one,
    {
      id: 'review',
      username: 'fictional-review',
      created: '2023-01-04T12:00:00Z',
      eligible: true,
      stage: 'review' as const,
      lastSeen: '2025-01-01T00:00:00Z',
    },
    {
      id: 'protected',
      username: 'fictional-protected',
      created: null,
      eligible: false,
      stage: 'protected',
      lastSeen: null,
    },
  ],
};
const confirmation =
  'I reviewed this selection and understand deletion is permanent.';
beforeEach(() => jest.resetAllMocks());
test('scans the whole preview and keeps global exclusions across account pages', async () => {
  post
    .mockResolvedValueOnce({ data: { ...batch, building: true } })
    .mockResolvedValueOnce({ data: batch })
    .mockResolvedValueOnce({
      data: {
        ...batch,
        page: 2,
        items: [{ ...one, id: 'two', username: 'fictional-second' }],
      },
    })
    .mockResolvedValueOnce({ data: batch })
    .mockResolvedValueOnce({ data: { deleted: 99, skipped: 0, done: false } })
    .mockResolvedValueOnce({ data: { deleted: 100, skipped: 0, done: true } });
  render(<AdminSpamCleanup />);
  expect(post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Preview all accounts'));
  expect(
    await screen.findByRole('link', { name: 'fictional/spammer' }),
  ).toHaveAttribute('href', '/admin/user/fictional%2Fspammer');
  fireEvent.click(screen.getByText('Select all accounts in this stage'));
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Select fictional/spammer' }),
  );
  expect(screen.getByText('Delete 99 selected accounts')).toBeDisabled();
  fireEvent.click(screen.getByText('Next accounts'));
  await screen.findByText('fictional-second');
  expect(
    screen.getByRole('checkbox', { name: 'Select fictional-second' }),
  ).toBeChecked();
  fireEvent.click(screen.getByText('Previous accounts'));
  await screen.findByText('fictional/spammer');
  expect(
    screen.getByRole('checkbox', { name: 'Select fictional/spammer' }),
  ).not.toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: confirmation }));
  fireEvent.click(screen.getByText('Delete 99 selected accounts'));
  expect(await screen.findByText(/Complete. Deleted 100/)).toBeVisible();
  expect(post).toHaveBeenLastCalledWith('/api/admin/spam-cleanup/apply', {
    stage: 'inactive',
    previewId: batch.previewId,
    confirm: true,
    selection: 'all',
    accountIds: ['one'],
  });
});
test('limits selection to the chosen stage and sends that stage for deletion', async () => {
  post
    .mockResolvedValueOnce({ data: { ...batch, pages: 1 } })
    .mockResolvedValueOnce({ data: { deleted: 1, skipped: 0, done: true } });
  render(<AdminSpamCleanup />);
  fireEvent.click(screen.getByText('Preview all accounts'));
  await screen.findByText('fictional/spammer');

  fireEvent.change(screen.getByLabelText('Cleanup stage'), {
    target: { value: 'review' },
  });
  expect(screen.getByText('Delete 0 selected accounts')).toBeDisabled();
  expect(
    screen.getByRole('checkbox', { name: 'Select fictional/spammer' }),
  ).toBeDisabled();
  const reviewCheckbox = screen.getByRole('checkbox', {
    name: 'Select fictional-review',
  });
  expect(reviewCheckbox).toBeEnabled();
  fireEvent.click(reviewCheckbox);
  fireEvent.click(screen.getByRole('checkbox', { name: confirmation }));
  fireEvent.click(screen.getByText('Delete 1 selected accounts'));

  await screen.findByText(/Complete. Deleted 1/);
  expect(post).toHaveBeenLastCalledWith('/api/admin/spam-cleanup/apply', {
    stage: 'review',
    previewId: batch.previewId,
    confirm: true,
    selection: 'selected',
    accountIds: ['review'],
  });
});
test('clears selection and confirmation when switching stages and supports all eligible accounts', async () => {
  post.mockResolvedValue({ data: { ...batch, pages: 1 } });
  render(<AdminSpamCleanup />);
  fireEvent.click(screen.getByText('Preview all accounts'));
  await screen.findByText('fictional/spammer');

  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Select fictional/spammer' }),
  );
  fireEvent.click(screen.getByRole('checkbox', { name: confirmation }));
  expect(screen.getByText('Delete 1 selected accounts')).toBeEnabled();

  fireEvent.change(screen.getByLabelText('Cleanup stage'), {
    target: { value: 'review' },
  });
  expect(screen.getByText('Delete 0 selected accounts')).toBeDisabled();
  expect(
    screen.getByRole('checkbox', { name: confirmation }),
  ).not.toBeChecked();
  expect(
    screen.getByRole('checkbox', { name: 'Select fictional-review' }),
  ).not.toBeChecked();

  fireEvent.change(screen.getByLabelText('Cleanup stage'), {
    target: { value: 'all' },
  });
  fireEvent.click(screen.getByText('Select all accounts in this stage'));
  expect(screen.getByText('Delete 101 selected accounts')).toBeDisabled();
  expect(
    screen.getByRole('checkbox', { name: 'Select fictional/spammer' }),
  ).toBeChecked();
  expect(
    screen.getByRole('checkbox', { name: 'Select fictional-review' }),
  ).toBeChecked();
  expect(
    screen.getByRole('checkbox', { name: 'Select fictional-protected' }),
  ).toBeDisabled();
});
test('supports individual selection, clearing and reticking excluded accounts', async () => {
  post.mockResolvedValue({ data: { ...batch, pages: 1 } });
  render(<AdminSpamCleanup />);
  fireEvent.click(screen.getByText('Preview all accounts'));
  await screen.findByText('fictional/spammer');
  const checkbox = screen.getByRole('checkbox', {
    name: 'Select fictional/spammer',
  });
  expect(checkbox).not.toBeChecked();
  fireEvent.click(checkbox);
  expect(screen.getByText('Delete 1 selected accounts')).toBeDisabled();
  fireEvent.click(checkbox);
  expect(screen.getByText('Delete 0 selected accounts')).toBeDisabled();
  fireEvent.click(screen.getByText('Select all accounts in this stage'));
  fireEvent.click(checkbox);
  fireEvent.click(checkbox);
  expect(screen.getByText('Delete 100 selected accounts')).toBeDisabled();
  fireEvent.click(screen.getByText('Clear selection'));
  expect(checkbox).not.toBeChecked();
  expect(
    screen.getByRole('checkbox', { name: 'Select fictional-protected' }),
  ).toBeDisabled();
});
test('reports preview, paging and apply errors without automatic retries', async () => {
  post
    .mockRejectedValueOnce(new Error('preview'))
    .mockResolvedValueOnce({ data: batch })
    .mockRejectedValueOnce(new Error('page'))
    .mockRejectedValueOnce(new Error('apply'));
  render(<AdminSpamCleanup />);
  fireEvent.click(screen.getByText('Preview all accounts'));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unable to preview cleanup.',
  );
  fireEvent.click(screen.getByText('Preview all accounts'));
  await screen.findByText('fictional/spammer');
  fireEvent.click(screen.getByText('Next accounts'));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unable to load this page.',
  );
  fireEvent.click(screen.getByText('Select all accounts in this stage'));
  fireEvent.click(screen.getByRole('checkbox', { name: confirmation }));
  fireEvent.click(screen.getByText('Delete 100 selected accounts'));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Cleanup interrupted.',
  );
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
test('shows cumulative progress while processing all selected accounts', async () => {
  let finish: ((value: unknown) => void) | undefined;
  post
    .mockResolvedValueOnce({ data: { ...batch, pages: 0, items: [] } })
    .mockResolvedValueOnce({ data: { deleted: 100, skipped: 0, done: false } })
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }) as never,
    );
  render(<AdminSpamCleanup />);
  fireEvent.click(screen.getByText('Preview all accounts'));
  await screen.findByText(/Full preview/);
  fireEvent.click(screen.getByText('Select all accounts in this stage'));
  fireEvent.click(screen.getByRole('checkbox', { name: confirmation }));
  fireEvent.click(screen.getByText('Delete 100 selected accounts'));
  expect(await screen.findByText(/Processing… Deleted 100/)).toBeVisible();
  await act(async () =>
    finish?.({ data: { deleted: 101, skipped: 0, done: true } }),
  );
  expect(await screen.findByText(/Complete. Deleted 101/)).toBeVisible();
  await waitFor(() => expect(post).toHaveBeenCalledTimes(3));
});

test('shows scanning progress before the full preview is ready', async () => {
  let finish: ((value: unknown) => void) | undefined;
  post
    .mockResolvedValueOnce({ data: { ...batch, building: true } })
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }) as never,
    );
  render(<AdminSpamCleanup />);
  fireEvent.click(screen.getByText('Preview all accounts'));
  expect(await screen.findByText(/Scanned 102 candidates/)).toBeVisible();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  await act(async () => finish?.({ data: batch }));
  expect(
    await screen.findByRole('table', { name: 'Account review' }),
  ).toBeVisible();
});
