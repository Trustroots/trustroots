import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminBlockedByMe from '@/modules/admin/client/components/AdminBlockedByMe.component';
import { getStaffBlockers } from '@/modules/admin/client/api/blocked-by-me.api';

jest.mock('@/modules/admin/client/api/blocked-by-me.api');
jest.mock('@/modules/core/client/services/client-runtime', () => ({
  getCurrentUser: () => ({ roles: ['welcome-team'] }),
}));

it('shows the members who blocked the signed-in staff member', async () => {
  getStaffBlockers.mockResolvedValueOnce([
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

  render(<AdminBlockedByMe />);

  expect(
    await screen.findByText('Sample Member (@sample-member)'),
  ).toBeInTheDocument();
});

it('shows an empty state when nobody has blocked the staff member', async () => {
  getStaffBlockers.mockResolvedValueOnce([
    { _id: 'staff-1', username: 'staff', blockedBy: [] },
  ]);

  render(<AdminBlockedByMe />);

  expect(
    await screen.findByText('No members have blocked your account.'),
  ).toBeInTheDocument();
});
