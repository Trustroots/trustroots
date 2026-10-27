import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminHeader from '@/modules/admin/client/components/AdminHeader.component';

type AdminUserFixture = NonNullable<Window['user']>;

jest.mock('@/modules/core/client/services/client-runtime', () => ({
  getCurrentUser: () => global.window.user,
}));

afterEach(() => {
  window.history.pushState({}, '', '/');
});

beforeEach(() => {
  window.user = { roles: ['admin'] };
});
afterEach(() => {
  delete window.user;
});

describe('<AdminHeader />', () => {
  it('groups administrator links by task', () => {
    render(<AdminHeader />);

    for (const [name, labels] of [
      [
        'Member support',
        [
          'Support inbox',
          'External connection search',
          'Staff blockers',
          'Location corrections',
        ],
      ],
      ['Circles', ['Circles', 'Hackerspaces']],
      ['Experiences', ['Reference threads', 'Experience changes']],
      ['Outreach', ['Acquisition stories', 'Newsletter']],
      ['Audit', ['Audit log', 'Username changes']],
    ] as const) {
      const group = within(screen.getByRole('list', { name }));
      expect(group.getAllByRole('link').map(link => link.textContent)).toEqual(
        labels,
      );
    }
  });

  it('shows support navigation without administrator tools', () => {
    window.user = { roles: ['support-team'] };
    render(<AdminHeader />);
    expect(
      screen.getByRole('link', { name: 'Support inbox' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'External connection search' }),
    ).toHaveAttribute('href', '/admin/network-connections');
    expect(
      screen.getByRole('link', { name: 'Staff blockers' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Location corrections' }),
    ).toHaveAttribute('href', '/admin/location-corrections');
    expect(
      screen.getByRole('link', { name: 'Experience changes' }),
    ).toHaveAttribute('href', '/admin/experience-changes');
    expect(
      screen.queryByRole('link', { name: 'Messages' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('list', { name: 'Conversations' }),
    ).not.toBeInTheDocument();
  });
  it.each([
    { roles: ['welcome-team'] },
    {},
    null,
  ] as Array<AdminUserFixture | null>)(
    'shows only acquisition navigation for non-admin %j',
    user => {
      window.user = user;
      render(<AdminHeader />);
      expect(screen.getAllByRole('link')).toHaveLength(
        user?.roles?.includes('welcome-team') ? 3 : 1,
      );
      expect(
        screen.queryByRole('link', { name: 'Audit log' }),
      ).not.toBeInTheDocument();

      expect(
        screen.getByRole('link', { name: 'Acquisition stories' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: 'Analysis' }),
      ).not.toBeInTheDocument();
      if (user?.roles?.includes('welcome-team')) {
        expect(
          screen.getByRole('link', { name: 'Location corrections' }),
        ).toHaveAttribute('href', '/admin/location-corrections');
      }
    },
  );

  it('shows the blocked-member support page to Greeters', () => {
    window.user = { roles: ['welcome-team'] };
    render(<AdminHeader />);

    expect(
      screen.getByRole('link', { name: 'Staff blockers' }),
    ).toHaveAttribute('href', '/admin/staff-blockers');
  });

  it('omits conversation navigation while on a conversation route', () => {
    window.history.pushState({}, '', '/admin/messages');

    render(<AdminHeader />);

    expect(
      screen.getByRole('navigation', { name: 'Administration' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('list', { name: 'Conversations' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Messages' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Threads' }),
    ).not.toBeInTheDocument();
  });

  it('marks acquisition stories as active', () => {
    window.history.pushState({}, '', '/admin/acquisition-stories');

    render(<AdminHeader />);

    expect(
      screen.getByRole('link', { name: 'Acquisition stories' }).closest('li'),
    ).toHaveClass('active');
    expect(
      screen.queryByRole('link', { name: 'Analysis' }),
    ).not.toBeInTheDocument();
  });

  it('focuses the first available admin input', () => {
    render(
      <>
        <AdminHeader />
        <main className="container">
          <input aria-label="First field" />
          <input aria-label="Second field" />
        </main>
      </>,
    );

    expect(screen.getByLabelText('First field')).toHaveFocus();
  });
});
