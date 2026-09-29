import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminBlockedByMe from '@/modules/admin/client/components/AdminBlockedByMe.component';
import { getMembersWhoBlockedMe } from '@/modules/admin/client/api/blocked-by-me.api';

jest.mock('@/modules/admin/client/api/blocked-by-me.api');

it('shows the members who blocked the signed-in staff member', async () => {
  getMembersWhoBlockedMe.mockResolvedValueOnce([
    { _id: 'member-1', username: 'sample-member', displayName: 'Sample Member' },
  ]);

  render(<AdminBlockedByMe />);

  expect(
    await screen.findByText('Sample Member (@sample-member)'),
  ).toBeInTheDocument();
});

it('shows an empty state when nobody has blocked the staff member', async () => {
  getMembersWhoBlockedMe.mockResolvedValueOnce([]);

  render(<AdminBlockedByMe />);

  expect(
    await screen.findByText('No members have blocked your account.'),
  ).toBeInTheDocument();
});
