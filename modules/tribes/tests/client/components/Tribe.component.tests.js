import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import Tribe from '@/modules/tribes/client/components/Tribe';

const tribe = {
  _id: 'tribe-id',
  slug: 'hitchhikers',
  label: 'Hitchhikers',
  count: 0,
};

describe('<Tribe />', () => {
  it('renders a new empty circle with signup join link', () => {
    render(
      <Tribe
        tribe={{ ...tribe, new: true, image: 'hitchhikers.jpg' }}
        user={null}
        onMembershipUpdated={jest.fn()}
      />,
    );

    expect(screen.getByRole('link', { name: /Hitchhikers/ })).toHaveAttribute(
      'href',
      '/circles/hitchhikers',
    );
    expect(screen.getByText('New circle!')).toBeInTheDocument();
    expect(screen.getByText('No members yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Join/ })).toHaveAttribute(
      'href',
      '/signup?tribe=hitchhikers',
    );
  });

  it('renders member count without the new-circle badge', () => {
    render(
      <Tribe
        tribe={{ ...tribe, count: 12, new: false }}
        user={null}
        onMembershipUpdated={jest.fn()}
      />,
    );

    expect(screen.getByText('12 members')).toBeInTheDocument();
    expect(screen.queryByText('New circle!')).not.toBeInTheDocument();
  });
});
