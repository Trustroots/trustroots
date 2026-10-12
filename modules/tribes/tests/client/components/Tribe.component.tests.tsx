import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import Tribe from '@/modules/tribes/client/components/Tribe';
import type {
  TribeSummary,
  MembershipUpdate,
} from '@/modules/tribes/client/api/tribes.api';

const tribe: TribeSummary = {
  _id: 'tribe-id',
  slug: 'hitchhikers',
  label: 'Hitchhikers',
  count: 0,
  color: 'aa00ff',
};

describe('<Tribe />', () => {
  it('renders a new empty circle with signup join link', () => {
    const { container } = render(
      <Tribe
        tribe={{ ...tribe, new: true, image: 'hitchhikers.jpg' }}
        user={undefined}
        onMembershipUpdated={jest.fn<void, [MembershipUpdate]>()}
      />,
    );

    expect(screen.getByRole('link', { name: /Hitchhikers/ })).toHaveAttribute(
      'href',
      '/circles/hitchhikers',
    );
    expect(screen.getByText('New circle!')).toBeInTheDocument();
    expect(screen.getByText('No members yet')).toBeInTheDocument();
    expect(container.firstChild).toHaveStyle({ backgroundColor: '#aa00ff' });
    expect(screen.getByRole('link', { name: /Join/ })).toHaveAttribute(
      'href',
      '/signup?tribe=hitchhikers',
    );
  });

  it('renders member count without the new-circle badge', () => {
    render(
      <Tribe
        tribe={{ ...tribe, count: 12, new: false }}
        user={undefined}
        onMembershipUpdated={jest.fn<void, [MembershipUpdate]>()}
      />,
    );

    expect(screen.getByText('12 members')).toBeInTheDocument();
    expect(screen.queryByText('New circle!')).not.toBeInTheDocument();
  });
});
