import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FlaggedMembers from '../../../client/components/FlaggedMembers.component';
import * as api from '../../../client/api/support.api';
jest.mock('../../../client/components/AdminHeader.component', () => () => null);
jest.mock('../../../client/api/support.api');
const load = jest.mocked(api.load);
const data = {
  items: [
    {
      _id: 'member-1',
      username: 'fictional-member',
      displayName: 'Fictional Member',
      public: true,
      roles: ['user', 'flagged'],
    },
  ],
  page: 1,
  hasMore: true,
};
afterEach(() => jest.resetAllMocks());
it('shows flagged member links and pages through results', async () => {
  load.mockResolvedValueOnce(data);
  render(<FlaggedMembers />);
  expect(screen.getByRole('status')).toHaveTextContent(
    'Loading flagged members',
  );
  const table = await screen.findByRole('table');
  expect(table).toHaveTextContent('Flagged for follow-up');
  expect(
    screen.getByRole('link', { name: 'fictional-member (Fictional Member)' }),
  ).toHaveAttribute('href', '/admin/support/member/fictional-member');
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  load.mockResolvedValueOnce({ ...data, page: 2, hasMore: false });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('Page 2');
  expect(load).toHaveBeenLastCalledWith(
    '/api/admin/support-flagged-members?page=2',
  );
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  load.mockResolvedValueOnce(data);
  fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
  await screen.findByText('Page 1');
});
it('shows empty results', async () => {
  load.mockResolvedValue({ items: [], page: 1, hasMore: false });
  render(<FlaggedMembers />);
  expect(
    await screen.findByText('No flagged members on this page.'),
  ).toBeVisible();
});
it('shows failures', async () => {
  load.mockRejectedValue(new Error('offline'));
  render(<FlaggedMembers />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not load flagged members.',
  );
});
it.each(['resolve', 'reject'])('ignores %s after unmount', async outcome => {
  let resolve!: (value: unknown) => void;
  let reject!: (error: Error) => void;
  load.mockReturnValue(
    new Promise((yes, no) => {
      resolve = yes;
      reject = no;
    }),
  );
  const view = render(<FlaggedMembers />);
  view.unmount();
  await act(async () => {
    if (outcome === 'resolve') resolve(data);
    else reject(new Error('offline'));
  });
});
