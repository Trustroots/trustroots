import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import Admin from '@/modules/admin/client/components/Admin.component';
import * as usersApi from '@/modules/admin/client/api/users.api';

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
  window.history.pushState({}, '', '/');
});

describe('<Admin />', () => {
  it('renders grouped admin workflow links', () => {
    window.history.pushState({}, '', '/admin');
    render(<Admin />);

    expect(screen.queryByText(/Welcome, friend!/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Team Guide' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Search members' }),
    ).toBeInTheDocument();
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
  });
});
