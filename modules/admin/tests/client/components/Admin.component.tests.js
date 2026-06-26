import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import Admin from '@/modules/admin/client/components/Admin.component';
import * as dashboardApi from '@/modules/admin/client/api/admin-dashboard.api';
import * as usersApi from '@/modules/admin/client/api/users.api';

jest.mock('@/modules/admin/client/api/admin-dashboard.api');
jest.mock('@/modules/admin/client/api/users.api');

function expectLink(name, href) {
  expect(
    screen
      .getAllByRole('link')
      .filter(link => (link.textContent || '').trim().startsWith(name))
      .some(link => link.getAttribute('href') === href),
  ).toBe(true);
}

afterEach(() => {
  jest.clearAllMocks();
  window.history.pushState({}, '', '/');
});

describe('<Admin />', () => {
  beforeEach(() => {
    dashboardApi.getAdminDashboard.mockResolvedValue({
      negativeReviews: [
        {
          _id: 'review-1',
          created: '2026-06-20T12:00:00.000Z',
          userFrom: {
            _id: 'user-from-1',
            displayName: 'Sender',
            username: 'sender',
          },
          userTo: {
            _id: 'user-to-1',
            displayName: 'Receiver',
            username: 'receiver',
          },
        },
      ],
      topMessengers: [
        {
          messageCount: 12,
          user: {
            _id: 'user-1',
            displayName: 'Alice',
            username: 'alice',
          },
        },
      ],
    });
  });

  it('renders grouped admin workflow links', async () => {
    window.history.pushState({}, '', '/admin');
    render(<Admin />);

    expect(screen.queryByText(/Welcome, friend!/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Team Guide' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Search members' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText('Name, username or email'),
    ).toBeInTheDocument();

    [
      'Members',
      'Moderation',
      'Community/admin tools',
      'External tools',
    ].forEach(heading => {
      expect(
        screen.getByRole('heading', { name: heading }),
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('link', { name: 'Search members' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Member report card' }),
    ).not.toBeInTheDocument();
    expectLink('Member threads', '/admin/threads');
    expectLink('Messages', '/admin/messages');
    expectLink('Reference threads', '/admin/reference-threads');
    expectLink('Audit log', '/admin/audit-log');
    expectLink('Acquisition stories', '/admin/acquisition-stories');
    expectLink(
      'Acquisition story analysis',
      '/admin/acquisition-stories/analysis',
    );
    expectLink('Newsletter', '/admin/newsletter');
    expectLink('Support queue', 'https://trustroots.zendesk.com/inbox/');
    expectLink('Blog admin', 'https://ideas.trustroots.org/wp-admin/');
    expectLink(
      'Newsletter admin',
      'https://ideas.trustroots.org/wp-admin/admin.php?page=mailpoet-newsletters',
    );
    expectLink('Statistics', 'https://grafana.trustroots.org/');

    expect(
      screen.queryByText('Remember to logout on public computers!'),
    ).not.toBeInTheDocument();
    expect(usersApi.searchUsers).not.toHaveBeenCalled();
    expect(
      await screen.findByRole('heading', {
        name: 'Top 10 Messengers Last Week',
      }),
    ).toBeInTheDocument();
    expect(await screen.findByText('12 messages')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Last 5 Negative Reviews' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'sender (Sender)' }),
    ).toHaveAttribute('href', '/admin/user?id=user-from-1');
  });
});
