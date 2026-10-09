import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import Navigation from '@/modules/pages/client/components/Navigation.component';
import type Avatar from '@/modules/users/client/components/Avatar.component';

type AvatarProps = React.ComponentProps<typeof Avatar>;
type NavigationProps = React.ComponentProps<typeof Navigation>;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/modules/users/client/components/Avatar.component.js', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockAvatar({ user }: AvatarProps) {
    return <div data-testid="avatar">{user.username}</div>;
  }

  return MockAvatar;
});

describe('<Navigation />', () => {
  const user: NavigationProps['user'] = {
    _id: 'member-1',
    username: 'sample-member',
    displayName: 'Sample Member',
  };

  it('renders profile and navigation links for a signed-in user', () => {
    render(
      <Navigation
        user={user}
        onSignout={jest.fn<void, Parameters<NavigationProps['onSignout']>>()}
      />,
    );

    expect(screen.getByText('Sample Member')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit profile' })).toHaveAttribute(
      'href',
      '/profile/edit',
    );
    expect(screen.getByRole('link', { name: 'Host' })).toHaveAttribute(
      'href',
      '/offer/host',
    );
    expect(screen.getByText('Sample Member').closest('a')).toHaveAttribute(
      'href',
      '/profile/sample-member',
    );
    expect(screen.getByTestId('avatar')).toHaveTextContent('sample-member');
    const wikiLink = screen.getByRole('link', { name: 'Wiki' });
    expect(wikiLink).toHaveAttribute('href', 'https://wiki.trustroots.org/');
    expect(wikiLink).toHaveAttribute('target', '_blank');
    expect(wikiLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: 'Statistics' })).toHaveAttribute(
      'href',
      '/statistics',
    );
    expect(screen.getByRole('link', { name: 'Safety' })).toHaveAttribute(
      'href',
      '/safety',
    );
  });

  it('renders the Info and support links from the shared registry in order', () => {
    const { container } = render(
      <Navigation
        user={user}
        onSignout={jest.fn<void, Parameters<NavigationProps['onSignout']>>()}
      />,
    );

    expect(screen.getByText('Info & support')).toBeInTheDocument();

    const groups = container.querySelectorAll('.list-group');
    expect(groups).toHaveLength(2);
    const links = Array.from(groups[1].querySelectorAll('a'));
    expect(links.map(link => link.textContent)).toEqual([
      'About',
      'Blog',
      'Contact & Support',
      'FAQ',
      'Foundation',
      'Media',
      'Wiki',
      'Privacy',
      'Rules',
      'Safety',
      'Statistics',
    ]);
    expect(links.map(link => link.getAttribute('href'))).toEqual([
      '/about',
      'https://ideas.trustroots.org/',
      '/support',
      '/faq',
      '/foundation',
      '/media',
      'https://wiki.trustroots.org/',
      '/privacy',
      '/rules',
      '/safety',
      '/statistics',
    ]);
    // Only Wiki opens in a new tab; the registry drives this via opensInNewTab.
    links.forEach(link => {
      if (link.getAttribute('href') === 'https://wiki.trustroots.org/') {
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      } else {
        expect(link).not.toHaveAttribute('target');
        expect(link).not.toHaveAttribute('rel');
      }
    });
  });

  it('invokes onSignout when sign out link is clicked', () => {
    const onSignout = jest.fn<void, Parameters<NavigationProps['onSignout']>>();
    render(<Navigation user={user} onSignout={onSignout} />);

    fireEvent.click(screen.getByRole('link', { name: 'Sign out' }));

    expect(onSignout).toHaveBeenCalledTimes(1);
  });
});
