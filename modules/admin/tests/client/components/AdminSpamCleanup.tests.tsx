import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
const batch = {
  previewId: 'fictional-preview',
  expiresAt: '2030-01-01T00:00:00Z',
  eligible: 1,
  protected: 1,
  hasMore: true,
  items: [
    {
      id: 'one',
      username: 'fictional/spammer',
      created: '2021-07-04T12:00:00Z',
      eligible: true,
    },
    {
      id: 'two',
      username: 'fictional-retained',
      created: '2021-07-04T12:00:00Z',
      eligible: false,
    },
  ],
};
beforeEach(() => jest.resetAllMocks());
test('reviews accounts and explicitly deletes only the previewed batch', async () => {
  post
    .mockResolvedValueOnce({ data: batch })
    .mockResolvedValueOnce({ data: { deleted: 1, skipped: 0 } });
  render(<AdminSpamCleanup />);
  expect(post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Preview first batch' }));
  expect(
    await screen.findByRole('link', { name: 'fictional/spammer' }),
  ).toHaveAttribute('href', '/admin/user/fictional%2Fspammer');
  const remove = screen.getByRole('button', {
    name: 'Delete 1 eligible accounts',
  });
  expect(remove).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(remove);
  expect(await screen.findByText(/Deleted 1; skipped 0/)).toBeVisible();
  expect(post).toHaveBeenLastCalledWith('/api/admin/spam-cleanup/apply', {
    previewId: batch.previewId,
    confirm: true,
  });
});
test('previews later batches without deleting and resets confirmation', async () => {
  post
    .mockResolvedValueOnce({ data: batch })
    .mockResolvedValueOnce({ data: { ...batch, hasMore: false, eligible: 0 } });
  render(<AdminSpamCleanup />);
  fireEvent.click(screen.getByText('Preview first batch'));
  fireEvent.click(await screen.findByRole('checkbox'));
  fireEvent.click(screen.getByText('Preview next batch without deleting'));
  await waitFor(() =>
    expect(post).toHaveBeenLastCalledWith('/api/admin/spam-cleanup/preview', {
      after: 'two',
    }),
  );
  expect(await screen.findByRole('checkbox')).not.toBeChecked();
  expect(screen.getByText('Delete 0 eligible accounts')).toBeDisabled();
});
test('reports preview failure and interrupted deletion without automatic retry', async () => {
  post
    .mockRejectedValueOnce(new Error('unavailable'))
    .mockResolvedValueOnce({ data: batch })
    .mockRejectedValueOnce(new Error('interrupted'));
  render(<AdminSpamCleanup />);
  fireEvent.click(screen.getByText('Preview first batch'));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unable to preview cleanup.',
  );
  fireEvent.click(screen.getByText('Preview first batch'));
  fireEvent.click(await screen.findByRole('checkbox'));
  fireEvent.click(screen.getByText('Delete 1 eligible accounts'));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unable to complete cleanup.',
  );
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});
