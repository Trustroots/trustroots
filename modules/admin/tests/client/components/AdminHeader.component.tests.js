import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import AdminHeader from '@/modules/admin/client/components/AdminHeader.component';

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
  it.each([{ roles: ['welcome-team'] }, {}, null])(
    'shows only acquisition navigation for non-admin %j',
    user => {
      window.user = user;
      render(<AdminHeader />);
      expect(
        screen.getByRole('link', { name: 'Welcome team' }),
      ).toHaveAttribute('href', '/admin/acquisition-stories');
      expect(screen.getAllByRole('link')).toHaveLength(
        user?.roles?.includes('welcome-team') ? 4 : 3,
      );
      expect(
        screen.queryByRole('link', { name: 'Audit log' }),
      ).not.toBeInTheDocument();

      expect(
        screen.getByRole('link', { name: 'Acquisition stories' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Analysis' })).toHaveAttribute(
        'href',
        '/admin/acquisition-stories/analysis',
      );
      if (user?.roles?.includes('welcome-team')) {
        expect(
          screen.getByRole('link', { name: 'Location corrections' }),
        ).toHaveAttribute('href', '/admin/location-corrections');
      }
    },
  );

  it('marks the current admin page as active', () => {
    window.history.pushState({}, '', '/admin/messages');

    render(<AdminHeader />);

    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute(
      'href',
      '/admin',
    );
    expect(
      screen.getByRole('link', { name: 'Messages' }).closest('li'),
    ).toHaveClass('active');
    expect(
      screen.getByRole('link', { name: 'Threads' }).closest('li'),
    ).not.toHaveClass('active');
  });

  it('marks the most specific nested admin page as active', () => {
    window.history.pushState({}, '', '/admin/acquisition-stories/analysis');

    render(<AdminHeader />);

    expect(
      screen.getByRole('link', { name: 'Acquisition stories' }).closest('li'),
    ).not.toHaveClass('active');
    expect(
      screen.getByRole('link', { name: 'Analysis' }).closest('li'),
    ).toHaveClass('active');
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
