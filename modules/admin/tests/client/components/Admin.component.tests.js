import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import Admin from '@/modules/admin/client/components/Admin.component';

afterEach(() => {
  window.history.pushState({}, '', '/');
});

describe('<Admin />', () => {
  it('renders main links and logout reminder', () => {
    window.history.pushState({}, '', '/admin');
    render(<Admin />);

    expect(screen.getByText(/Welcome, friend!/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Team Guide' })).toHaveAttribute(
      'href',
      'https://team.trustroots.org/',
    );
    expect(screen.getByRole('link', { name: 'Support queue' })).toHaveAttribute(
      'href',
      'https://trustroots.zendesk.com/inbox/',
    );
    expect(
      screen.getByText('Remember to logout on public computers!'),
    ).toBeInTheDocument();
  });

  it('renders every known admin destination', () => {
    render(<Admin />);

    ['Member report card', 'Search members', 'Messages', 'Threads'].forEach(
      label => {
        expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
      },
    );
  });
});
