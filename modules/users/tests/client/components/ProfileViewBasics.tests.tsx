import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import ProfileViewBasics from '@/modules/users/client/components/ProfileViewBasics';
import type { UserProfile } from '@/modules/users/client/types';
import type LanguageList from '@/modules/users/client/components/LanguageList';
import type ProfileNostrBadge from '@/modules/users/client/components/ProfileNostrBadge.component';

jest.mock('@/modules/users/client/components/LanguageList', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockLanguageList({
    className,
    languages = [],
  }: React.ComponentProps<typeof LanguageList>) {
    return (
      <ul className={className}>
        {languages.map(language => (
          <li key={language}>{`language-${language}`}</li>
        ))}
      </ul>
    );
  }

  return MockLanguageList;
});

jest.mock(
  '@/modules/users/client/components/ProfileNostrBadge.component',
  () => {
    const React = jest.requireActual<typeof import('react')>('react');

    function MockProfileNostrBadge({
      npubHex,
    }: React.ComponentProps<typeof ProfileNostrBadge>) {
      return (
        <div data-testid="profile-nostr-badge">{npubHex || 'no-npub-hex'}</div>
      );
    }

    return MockProfileNostrBadge;
  },
);

const makeProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  _id: 'user-1',
  username: 'member-one',
  displayName: 'Member One',
  ...overrides,
});

describe('<ProfileViewBasics />', () => {
  it('shows the greeter badge alongside volunteer recognition and removes it when revoked', () => {
    const profile = {
      _id: 'fictional-member',
      username: 'fictional-member',
      displayName: 'Fictional Member',
      isGreeter: true,
      isVolunteer: true,
    };
    const { rerender } = render(<ProfileViewBasics profile={profile} />);
    expect(
      screen.getByRole('link', { name: 'Trustroots greeter' }),
    ).toHaveAttribute('href', '/team/greeters');
    expect(
      screen.getByRole('link', { name: 'Trustroots volunteer' }),
    ).toHaveAttribute('href', '/team');
    rerender(<ProfileViewBasics profile={{ ...profile, isGreeter: false }} />);
    expect(
      screen.queryByRole('link', { name: 'Trustroots greeter' }),
    ).not.toBeInTheDocument();
  });

  it('renders member profile basics, locations, languages, and networks', () => {
    render(
      <ProfileViewBasics
        profile={makeProfile({
          additionalProvidersData: {
            facebook: { id: 'hidden-facebook-id' },
            github: { login: 'sample-project' },
          },
          birthdate: '1990-06-01T00:00:00.000Z',
          created: '2020-01-01T00:00:00.000Z',
          extSitesBW: 'member-bw',
          extSitesCS: 'member-cs',
          extSitesCouchers: 'member-couchers',
          extSitesWS: '12345',
          gender: 'female',
          isVolunteer: true,
          languages: ['en', 'pt'],
          locationFrom: 'Northport',
          locationLiving: 'Seaview',
          nostrNpub: 'npub1trustroots',
          // Preserve the formatted API values used by this rendering regression.
          replyRate: '80%' as unknown as number,
          replyTime: '3 hours' as unknown as number,
          seen: '2020-01-03T00:00:00.000Z',
        })}
      />,
    );

    expect(screen.getByText('Trustroots volunteer')).toBeInTheDocument();
    expect(screen.getByText('Reply rate 80%.')).toBeInTheDocument();
    expect(screen.getByText('Replies within 3 hours.')).toBeInTheDocument();
    expect(screen.getByText(/Female\./)).toBeInTheDocument();
    expect(screen.getByText(/Member since/)).toBeInTheDocument();
    expect(screen.getByText(/Online/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Seaview' })).toHaveAttribute(
      'href',
      '/search?location=Seaview',
    );
    expect(screen.getByRole('link', { name: 'Northport' })).toHaveAttribute(
      'href',
      '/search?location=Northport',
    );
    expect(screen.getByText('language-en')).toBeInTheDocument();
    expect(screen.getByText('language-pt')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/sample-project',
    );
    expect(
      screen.queryByRole('link', { name: 'Facebook' }),
    ).not.toBeInTheDocument();
    const nostrLink = screen.getByRole('link', { name: 'Nostroots' });
    expect(nostrLink).toHaveAttribute(
      'href',
      'https://nos.trustroots.org/v0/#profile/member-one%40trustroots.org',
    );
    expect(nostrLink).toHaveAttribute(
      'aria-describedby',
      'nostr-address-note-member-one',
    );
    expect(
      nostrLink.closest('li')?.querySelector('.nostroots-logo'),
    ).toHaveAttribute('src', '/img/external/nostroots-logo.png');
    expect(screen.getByText('Nostr address, not an email address')).toHaveClass(
      'sr-only',
    );
    expect(screen.getByRole('link', { name: 'Couchers.org' })).toHaveAttribute(
      'href',
      'https://couchers.org/user/member-couchers',
    );
    expect(screen.getByRole('link', { name: 'BeWelcome' })).toHaveAttribute(
      'href',
      'https://www.bewelcome.org/members/member-bw',
    );
    expect(screen.getByRole('link', { name: 'Couchsurfing' })).toHaveAttribute(
      'href',
      'https://www.couchsurfing.com/people/member-cs',
    );
    expect(screen.getByRole('link', { name: 'Warmshowers' })).toHaveAttribute(
      'href',
      'https://www.warmshowers.org/user/12345',
    );
  });

  it('renders the nostr npub fallback link when it is the only network', () => {
    const sparseProfile = makeProfile({
      created: '2020-01-01T00:00:00.000Z',
      languages: [],
      nostrNpub: 'npub1onlynetwork',
      seen: undefined,
    });
    // This case exercises the fallback when the profile has no username.
    Reflect.deleteProperty(sparseProfile, 'username');

    render(<ProfileViewBasics profile={sparseProfile} />);

    expect(screen.getByText('Elsewhere')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nostroots' })).toHaveAttribute(
      'href',
      'https://nos.trustroots.org/v0/#profile/npub1onlynetwork',
    );
  });

  it('passes valid npub identifiers to the Nostroots badge as hex', () => {
    render(
      <ProfileViewBasics
        profile={makeProfile({
          created: '2020-01-01T00:00:00.000Z',
          languages: [],
          nostrNpub:
            'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzqujme',
          seen: undefined,
        })}
      />,
    );

    expect(screen.getByTestId('profile-nostr-badge')).toHaveTextContent(
      '0000000000000000000000000000000000000000000000000000000000000000',
    );
  });

  it('passes null badge data for non-npub Nostr identifiers', () => {
    render(
      <ProfileViewBasics
        profile={makeProfile({
          created: '2020-01-01T00:00:00.000Z',
          languages: [],
          nostrNpub:
            'note1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqn2l0z3',
          seen: undefined,
        })}
      />,
    );

    expect(screen.getByTestId('profile-nostr-badge')).toHaveTextContent(
      'no-npub-hex',
    );
  });

  it('renders Warmshowers usernames and volunteer alumni labels', () => {
    render(
      <ProfileViewBasics
        profile={makeProfile({
          created: '2020-01-01T00:00:00.000Z',
          extSitesWS: 'member-warmshowers',
          isVolunteerAlumni: true,
          languages: [],
          seen: undefined,
        })}
      />,
    );

    expect(screen.getByText('Trustroots volunteer alumni')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Warmshowers' })).toHaveAttribute(
      'href',
      'https://www.warmshowers.org/users/member-warmshowers',
    );
  });

  it('renders zero reply rate without reply time', () => {
    render(
      <ProfileViewBasics
        profile={makeProfile({
          created: '2020-01-01T00:00:00.000Z',
          languages: [],
          // The component displays preformatted rates and treats an empty time as absent.
          replyRate: '0%' as unknown as number,
          replyTime: '' as unknown as number,
          seen: undefined,
        })}
      />,
    );

    expect(screen.getByText('Reply rate 0%.')).toBeInTheDocument();
    expect(screen.queryByText(/^Replies within/)).not.toBeInTheDocument();
  });

  it('renders sparse profile fallback details without optional sections', () => {
    render(
      <ProfileViewBasics
        profile={makeProfile({
          created: undefined,
          // Regression fixture: the API can return null for a provider entry.
          additionalProvidersData: { github: null } as unknown as NonNullable<
            UserProfile['additionalProvidersData']
          >,
          languages: [],
          seen: undefined,
        })}
      />,
    );

    expect(screen.getByText(/Member since/)).toBeInTheDocument();
    expect(screen.getByText('Online long ago')).toBeInTheDocument();
    expect(screen.queryByText(/^Reply rate/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Replies within/)).not.toBeInTheDocument();
    expect(screen.queryByText('Languages')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'GitHub' })).toBeInTheDocument();
    expect(screen.getByText('Elsewhere')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Nostroots' }),
    ).not.toBeInTheDocument();
  });
});
