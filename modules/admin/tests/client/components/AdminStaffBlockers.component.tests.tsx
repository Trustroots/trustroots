import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminStaffBlockers from '@/modules/admin/client/components/AdminStaffBlockers.component';
import { getStaffBlockers } from '@/modules/admin/client/api/staff-blockers.api';
import type { StaffBlocker } from '@/modules/admin/shared/staff-blockers';
import { setViewer } from '@/testutils/client/auth.testutil';

jest.mock('@tanstack/react-router', () =>
  jest.requireActual('@/testutils/client/router-location.testutil'),
);
jest.mock('@/modules/admin/client/api/staff-blockers.api');
jest.mock('@/modules/core/client/react-app/auth', () =>
  jest.requireActual('@/testutils/client/auth.testutil').mockAuthModule(),
);

const mockedGetStaffBlockers = jest.mocked(getStaffBlockers);

beforeEach(() => {
  setViewer({ roles: ['welcome-team'] });
});

afterEach(() => {
  jest.clearAllMocks();
});

it('shows a loading message while waiting for the support list', () => {
  setViewer({});
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
  setViewer({ roles: ['admin'] });
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
    screen.getByRole('link', { name: 'support-admin (@support-admin)' }),
  ).toHaveAttribute('href', '/admin/user/support-admin');
  expect(
    screen.getByRole('link', { name: 'sample-member (@sample-member)' }),
  ).toHaveAttribute('href', '/admin/user/sample-member');
  expect(screen.getByRole('link', { name: 'Staff member' })).toHaveAttribute(
    'href',
    '/admin/user?id=staff-2',
  );
  expect(screen.getByRole('link', { name: 'Member' })).toHaveAttribute(
    'href',
    '/admin/user?id=member-2',
  );
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
    setViewer({ roles });
    mockedGetStaffBlockers.mockResolvedValueOnce([
      { _id: 'staff-1', username: 'staff', blockedBy: [] },
    ]);

    render(<AdminStaffBlockers />);

    expect(await screen.findByText(message)).toBeInTheDocument();
  },
);

it('shows a load error instead of reporting an empty blocker list', async () => {
  setViewer(null);
  mockedGetStaffBlockers.mockRejectedValueOnce(new Error('Unavailable'));

  render(<AdminStaffBlockers />);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not load members.',
  );
  expect(
    screen.queryByText('No members have blocked your account.'),
  ).not.toBeInTheDocument();
});
