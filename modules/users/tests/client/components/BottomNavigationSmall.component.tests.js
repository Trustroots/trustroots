import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import BottomNavigationSmall from '@/modules/users/client/components/BottomNavigationSmall.component';

describe('<BottomNavigationSmall />', () => {
  beforeEach(() => {
    window.history.pushState({}, 'Profile', '/profile/alice/accommodation');
  });

  it('renders mobile profile tabs and marks the current path active', () => {
    render(<BottomNavigationSmall contactCount={4} isSelf username="alice" />);

    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'href',
      '/profile/alice/overview',
    );
    expect(screen.getByRole('tab', { name: 'About' })).toHaveAttribute(
      'href',
      '/profile/alice',
    );
    expect(screen.getByRole('tab', { name: 'Hosting' })).toHaveAttribute(
      'href',
      '/profile/alice/accommodation',
    );
    expect(screen.getByRole('tab', { name: /Contacts/ })).toHaveAttribute(
      'href',
      '/profile/alice/contacts',
    );
    expect(screen.getByText('4')).toHaveClass('badge');
    expect(
      screen.getByRole('tab', { name: 'Hosting' }).closest('li'),
    ).toHaveClass('active');
  });

  it('updates active tab locally after a tab click', () => {
    render(<BottomNavigationSmall contactCount={0} isSelf username="alice" />);

    fireEvent.click(screen.getByRole('tab', { name: 'About' }));

    expect(
      screen.getByRole('tab', { name: 'About' }).closest('li'),
    ).toHaveClass('active');
    expect(
      screen.getByRole('tab', { name: 'Hosting' }).closest('li'),
    ).not.toHaveClass('active');
  });

  it('hides contacts tab from other members when there are no contacts', () => {
    render(
      <BottomNavigationSmall
        contactCount={0}
        isSelf={false}
        username="alice"
      />,
    );

    expect(
      screen.queryByRole('tab', { name: /Contacts/ }),
    ).not.toBeInTheDocument();
  });

  it('defaults the active tab to about when the path has no subpage', () => {
    window.history.pushState({}, 'Profile', '/profile/alice');

    render(<BottomNavigationSmall contactCount={0} isSelf username="alice" />);

    expect(
      screen.getByRole('tab', { name: 'About' }).closest('li'),
    ).toHaveClass('active');
  });

  it('shows contacts for the current user even with no contacts yet', () => {
    render(<BottomNavigationSmall contactCount={0} isSelf username="alice" />);

    expect(screen.getByRole('tab', { name: /Contacts/ })).toHaveAttribute(
      'href',
      '/profile/alice/contacts',
    );
  });
});
