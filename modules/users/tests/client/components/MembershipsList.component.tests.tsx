import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import MembershipsList from '@/modules/users/client/components/MembershipsList.component';
import type { TribeMembership } from '@/modules/users/client/types';
import type { TribeSummary } from '@/modules/tribes/client/api/tribes.api';

const membership = (
  id: string,
  slug: string,
  label: string,
  count: number,
  image?: string,
): TribeMembership & { tribe: TribeSummary } => ({
  tribe: { _id: id, slug, label, count, image },
});

const memberships = [
  membership('tribe-1', 'cyclists', 'Cyclists', 1200),
  membership('tribe-2', 'hikers', 'Hikers', 800),
  membership('tribe-3', 'artists', 'Artists', 50),
  membership('tribe-4', 'musicians', 'Musicians', 40),
  membership('tribe-5', 'chefs', 'Chefs', 30),
  membership('tribe-6', 'writers', 'Writers', 20),
];

describe('MembershipsList', () => {
  it('uses an empty membership list by default', () => {
    const { container } = render(<MembershipsList isOwnProfile={false} />);

    expect(container.firstChild).toBeEmptyDOMElement();
  });

  it('renders circle badges sorted by member count', () => {
    render(<MembershipsList isOwnProfile={false} memberships={memberships} />);

    expect(screen.getByRole('link', { name: 'Cyclists' })).toHaveAttribute(
      'href',
      '/circles/cyclists',
    );
    expect(screen.getByText('1,200 members')).toBeInTheDocument();
    expect(screen.queryByText('Writers')).not.toBeInTheDocument();
  });

  it('expands the list when show more is clicked', () => {
    render(<MembershipsList isOwnProfile={false} memberships={memberships} />);

    fireEvent.click(screen.getByRole('button', { name: 'Show more...' }));

    expect(screen.getByRole('link', { name: 'Writers' })).toBeInTheDocument();
  });

  it('shows an empty-state prompt on own profile without circles', () => {
    render(<MembershipsList isOwnProfile memberships={[]} />);

    expect(
      screen.getByText(
        'Joining circles helps you find likeminded Trustroots members.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Join circles' })).toHaveAttribute(
      'href',
      '/circles',
    );
  });

  it('shows join more circles link on own profile with memberships', () => {
    render(
      <MembershipsList isOwnProfile memberships={memberships.slice(0, 2)} />,
    );

    expect(
      screen.getByRole('link', { name: 'Join more circles' }),
    ).toHaveAttribute('href', '/circles');
  });

  it('renders image-backed circles and missing counts', () => {
    render(
      <MembershipsList
        isOwnProfile={false}
        memberships={[
          membership('tribe-image', 'image', 'Image circle', 0, '/image.jpg'),
        ]}
      />,
    );

    expect(
      screen.getByRole('link', { name: 'Image circle' }),
    ).toBeInTheDocument();
    expect(screen.getByText('No members yet')).toBeInTheDocument();
    const badge = document.querySelector<HTMLElement>('.tribe-badge')!;
    const image = document.querySelector<HTMLElement>('.tribe-badge-image')!;
    expect(badge).not.toHaveAttribute('style');
    expect(image).toHaveClass('tribe-image');
    expect(image.style.backgroundImage).toContain(
      '/uploads-circle/image/120x120.',
    );
  });
});
