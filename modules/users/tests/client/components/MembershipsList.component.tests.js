import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import MembershipsList from '@/modules/users/client/components/MembershipsList.component';

const memberships = [
  {
    tribe: {
      _id: 'tribe-1',
      slug: 'cyclists',
      label: 'Cyclists',
      count: 1200,
    },
  },
  {
    tribe: {
      _id: 'tribe-2',
      slug: 'hikers',
      label: 'Hikers',
      count: 800,
    },
  },
  {
    tribe: {
      _id: 'tribe-3',
      slug: 'artists',
      label: 'Artists',
      count: 50,
    },
  },
  {
    tribe: {
      _id: 'tribe-4',
      slug: 'musicians',
      label: 'Musicians',
      count: 40,
    },
  },
  {
    tribe: {
      _id: 'tribe-5',
      slug: 'chefs',
      label: 'Chefs',
      count: 30,
    },
  },
  {
    tribe: {
      _id: 'tribe-6',
      slug: 'writers',
      label: 'Writers',
      count: 20,
    },
  },
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
          {
            tribe: {
              _id: 'tribe-image',
              slug: 'image',
              label: 'Image circle',
              count: 0,
              image: '/image.jpg',
            },
          },
        ]}
      />,
    );

    expect(
      screen.getByRole('link', { name: 'Image circle' }),
    ).toBeInTheDocument();
    expect(screen.getByText('No members yet')).toBeInTheDocument();
  });
});
