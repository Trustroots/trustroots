import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminStaffBlockers from '@/modules/admin/client/components/AdminStaffBlockers.component';
import { getStaffBlockers } from '@/modules/admin/client/api/staff-blockers.api';
import { getCurrentUser } from '@/modules/core/client/services/client-runtime';
import type { StaffBlocker } from '@/modules/admin/shared/staff-blockers';

jest.mock('@/modules/admin/client/api/staff-blockers.api');
jest.mock('@/modules/core/client/services/client-runtime', () => ({
  getCurrentUser: jest.fn(),
}));

const mockedGetStaffBlockers = jest.mocked(getStaffBlockers);
const mockedGetCurrentUser = jest.mocked(getCurrentUser);

beforeEach(() => {
  mockedGetCurrentUser.mockReturnValue({ roles: ['welcome-team'] });
});

afterEach(() => {
  jest.clearAllMocks();
});

it('shows a loading message while waiting for the support list', () => {
  mockedGetCurrentUser.mockReturnValue({});
  mockedGetStaffBlockers.mockReturnValueOnce(
    new Promise<StaffBlocker[]>(() => {}),
  );

  render(<AdminStaffBlockers />);

  expect(screen.getByText('Loading members…')).toBeInTheDocument();
});

it('shows the members who blocked the signed-in Greeter', async () => {
  mockedGetStaffBlockers.mockResolvedValueOnce([
    {
      _id: 'staff-1',
      username: 'staff-member',
      displayName: 'Staff Member',
      blockedBy: [
        {
          _id: 'member-1',
          username: 'sample-member',
          displayName: 'Sample Member',
        },
      ],
    },
  ]);

  render(<AdminStaffBlockers />);

  expect(
    await screen.findByText('Sample Member (@sample-member)'),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'Members who blocked you' }),
  ).toBeInTheDocument();
});

it('groups blockers by staff account for administrators and omits empty groups', async () => {
  mockedGetCurrentUser.mockReturnValue({ roles: ['admin'] });
  mockedGetStaffBlockers.mockResolvedValueOnce([
    {
      _id: 'staff-1',
      username: 'support-admin',
      blockedBy: [{ _id: 'member-1', username: 'sample-member' }],
    },
    { _id: 'staff-2', blockedBy: [{ _id: 'member-2' }] },
    { _id: 'staff-3', username: 'no-blockers', blockedBy: [] },
  ]);

  render(<AdminStaffBlockers />);

  expect(
    await screen.findByRole('heading', {
      name: 'support-admin (@support-admin)',
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'Staff member' }),
  ).toBeInTheDocument();
  expect(
    screen.getByText('sample-member (@sample-member)'),
  ).toBeInTheDocument();
  expect(screen.getByText('Member', { exact: true })).toBeInTheDocument();
  expect(
    screen.queryByText('no-blockers', { exact: false }),
  ).not.toBeInTheDocument();
});

type EmptyBlockerCase = [string[], string];

it.each([
  [['welcome-team'], 'No members have blocked your account.'],
  [['admin'], 'No members have blocked staff accounts.'],
] as EmptyBlockerCase[])(
  'shows an empty state for %j',
  async (roles, message) => {
    mockedGetCurrentUser.mockReturnValue({ roles });
    mockedGetStaffBlockers.mockResolvedValueOnce([
      { _id: 'staff-1', username: 'staff', blockedBy: [] },
    ]);

    render(<AdminStaffBlockers />);

    expect(await screen.findByText(message)).toBeInTheDocument();
  },
);

it('shows a load error instead of reporting an empty blocker list', async () => {
  mockedGetCurrentUser.mockReturnValue(null);
  mockedGetStaffBlockers.mockRejectedValueOnce(new Error('Unavailable'));

  render(<AdminStaffBlockers />);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not load members.',
  );
  expect(
    screen.queryByText('No members have blocked your account.'),
  ).not.toBeInTheDocument();
});
