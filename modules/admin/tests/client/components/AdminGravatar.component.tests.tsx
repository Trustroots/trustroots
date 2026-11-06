import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminGravatar from '@/modules/admin/client/components/AdminGravatar.component';
import * as api from '@/modules/admin/client/api/gravatar.api';

jest.mock(
  '@/modules/admin/client/components/AdminHeader.component',
  () => () => null,
);
jest.mock('@/modules/admin/client/api/gravatar.api');
const getUsage = jest.mocked(api.getGravatarUsage);
const usage: api.GravatarUsage = {
  accounts: 51,
  page: 1,
  hasNextPage: true,
  measuredAt: '2026-11-06T12:00:00.000Z',
  members: [
    {
      _id: 'member-1',
      username: 'fictional-member',
      displayName: 'Fictional Member',
    },
  ],
};
afterEach(() => jest.resetAllMocks());

it('shows the count, measurement time, member links and pagination', async () => {
  getUsage.mockResolvedValueOnce(usage);
  render(<AdminGravatar />);
  expect(screen.getByRole('status')).toHaveTextContent(
    'Loading Gravatar usage',
  );
  const table = await screen.findByRole('table', { name: 'Gravatar members' });
  expect(table).toHaveTextContent('Fictional Member');
  expect(screen.getByText('51')).toBeVisible();
  expect(screen.getByText('2026-11-06 12:00')).toBeVisible();
  expect(
    screen.getByRole('link', { name: 'fictional-member' }),
  ).toHaveAttribute('href', '/admin/user/fictional-member');
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  getUsage.mockResolvedValueOnce({ ...usage, page: 2, hasNextPage: false });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('Page 2');
  expect(getUsage).toHaveBeenLastCalledWith(2);
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  getUsage.mockResolvedValueOnce(usage);
  fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
  await screen.findByText('Page 1');
  expect(getUsage).toHaveBeenLastCalledWith(1);
});
it('shows an empty state for zero accounts', async () => {
  getUsage.mockResolvedValue({
    ...usage,
    accounts: 0,
    members: [],
    hasNextPage: false,
  });
  render(<AdminGravatar />);
  expect(
    await screen.findByText('No Gravatar members on this page.'),
  ).toBeVisible();
  expect(screen.getByText('0')).toBeVisible();
});
it('shows a load failure', async () => {
  getUsage.mockRejectedValue(new Error('unavailable'));
  render(<AdminGravatar />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not load Gravatar usage.',
  );
});
it.each(['resolve', 'reject'])('ignores %s after unmount', async outcome => {
  let resolve!: (result: api.GravatarUsage) => void;
  let reject!: (error: Error) => void;
  getUsage.mockReturnValue(
    new Promise((yes, no) => {
      resolve = yes;
      reject = no;
    }),
  );
  const view = render(<AdminGravatar />);
  view.unmount();
  await act(async () => {
    if (outcome === 'resolve') resolve(usage);
    else reject(new Error('unavailable'));
  });
});
