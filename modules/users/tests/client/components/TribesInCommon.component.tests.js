import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import TribesInCommon from '@/modules/users/client/components/TribesInCommon.component';

const memberships = [
  { tribe: { _id: 'tribe-1', slug: 'cyclists', label: 'Cyclists' } },
  { tribe: { _id: 'tribe-2', slug: 'hikers', label: 'Hikers' } },
  { tribe: { _id: 'tribe-3', slug: 'artists', label: 'Artists' } },
];

describe('TribesInCommon', () => {
  it('uses empty lists by default', () => {
    const { container } = render(<TribesInCommon />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there are no circles in common', () => {
    const { container } = render(
      <TribesInCommon memberIds={['tribe-9']} memberships={memberships} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('lists shared circles with links', () => {
    const { container } = render(
      <TribesInCommon
        memberIds={['tribe-1', 'tribe-3']}
        memberships={memberships}
      />,
    );

    expect(container.firstChild).toHaveClass('profile-tribes-common');
    expect(screen.getByText('Circles in common')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cyclists' })).toHaveAttribute(
      'href',
      '/circles/cyclists',
    );
    expect(screen.getByRole('link', { name: 'Artists' })).toHaveAttribute(
      'href',
      '/circles/artists',
    );
    expect(
      screen.queryByRole('link', { name: 'Hikers' }),
    ).not.toBeInTheDocument();
  });
});
