import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import AdminHeader from '@/modules/admin/client/components/AdminHeader.component';

afterEach(() => {
  window.history.pushState({}, '', '/');
});

describe('<AdminHeader />', () => {
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

  it('marks nested admin pages as active', () => {
    window.history.pushState({}, '', '/admin/acquisition-stories/analysis');

    render(<AdminHeader />);

    expect(
      screen.getByRole('link', { name: 'Acquisition stories' }).closest('li'),
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
