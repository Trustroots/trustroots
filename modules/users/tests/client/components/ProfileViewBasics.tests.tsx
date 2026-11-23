import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import '@/config/client/i18n';
import ProfileViewBasics from '@/modules/users/client/components/ProfileViewBasics';
import type { UserProfile } from '@/modules/users/client/types';
import type LanguageList from '@/modules/users/client/components/LanguageList';
import type ProfileNostrBadge from '@/modules/users/client/components/ProfileNostrBadge.component';
import { malformedFixture } from '@/testutils/client/malformed-fixtures';

vi.mock('@/modules/users/client/components/LanguageList', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

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

  return { default: MockLanguageList };
});

vi.mock(
  '@/modules/users/client/components/ProfileNostrBadge.component',
  async () => {
    const React = await vi.importActual<typeof import('react')>('react');

    function MockProfileNostrBadge({
      npubHex,
    }: React.ComponentProps<typeof ProfileNostrBadge>) {
      return (
        <div data-testid="profile-nostr-badge">{npubHex || 'no-npub-hex'}</div>
      );
    }

    return { default: MockProfileNostrBadge };
  },
);

const makeProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  _id: 'user-1',
  username: 'member-one',
  displayName: 'Member One',
  ...overrides,
});

describe('<ProfileViewBasics />', () => {
  it.each([
    ['Hitchwiki', 'extSitesHitchwiki', 'https://hitchwiki.org/en/User:'],
    [
      'Hitchwiki Maps',
      'extSitesHitchwikiMaps',
      'https://maps.hitchwiki.org/account/',
    ],
  ])(
    'shows a %s account when it is the only network',
    (name, field, baseUrl) => {
      render(
        <ProfileViewBasics
          profile={makeProfile({ [field]: 'fictional hiker' })}
        />,
      );
      const link = screen.getByRole('link', {
        name: `${name}: fictional hiker`,
      });
      expect(link).toHaveAttribute('href', `${baseUrl}fictional%20hiker`);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link.closest('li')).toHaveAttribute('title', name);
    },
  );

  it.each(['household/fictional-host', 'address/fictional-host'])(
    'renders Servas as the only network and removes it when cleared: %s',
    path => {
      const { rerender } = render(
        <ProfileViewBasics profile={makeProfile({ extSitesServas: path })} />,
      );
      const link = screen.getByRole('link', { name: `Servas: ${path}` });
      expect(link).toHaveAttribute('href', `https://servas.org/${path}`);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link.closest('li')).toHaveAttribute('title', 'Servas');
      rerender(
        <ProfileViewBasics profile={makeProfile({ extSitesServas: '' })} />,
      );
      expect(
        screen.queryByRole('link', { name: `Servas: ${path}` }),
      ).not.toBeInTheDocument();
    },
  );

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
        profile={malformedFixture(
          makeProfile({
            additionalProvidersData: {
              facebook: { id: 'hidden-facebook-id' },
              github: { login: 'sample-project' },
            },
            birthdate: '1990-06-01T00:00:00.000Z',
            created: '2020-01-01T00:00:00.000Z',
            extSitesBW: 'member-bw',
            extSitesCS: 'member-cs',
            extSitesCouchers: 'member-couchers',
            extSitesWS: '00000000-0000-4000-8000-000000000001',
            gender: 'female',
            isVolunteer: true,
            languages: ['en', 'pt'],
            locationFrom: 'Northport',
            locationLiving: 'Seaview',
            nostrNpub: 'npub1trustroots',
            seen: '2020-01-03T00:00:00.000Z',
          }),
          { replyRate: '80%', replyTime: '3 hours' },
        )}
      />,
    );

    expect(screen.getByText('Trustroots volunteer')).toBeInTheDocument();
    expect(screen.getByText('Reply rate 80%.')).toBeInTheDocument();
    expect(screen.getByText('Replies within 3 hours.')).toBeInTheDocument();
    expect(screen.getByText(/Female\./)).toBeInTheDocument();
    expect(screen.getByText(/^Registered .+ ago$/)).toHaveAttribute(
      'datetime',
      '2020-01-01T00:00:00.000Z',
    );
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
    expect(
      screen.getByRole('link', { name: 'CO: member-couchers' }),
    ).toHaveAttribute('href', 'https://couchers.org/user/member-couchers');
    expect(screen.getByRole('link', { name: 'BW: member-bw' })).toHaveAttribute(
      'href',
      'https://www.bewelcome.org/members/member-bw',
    );
    expect(screen.getByText('CS: member-cs')).toBeVisible();
    expect(
      screen
        .getByTitle('Couchsurfing')
        .closest('li')
        ?.querySelector('i, img, svg'),
    ).toBeNull();
    expect(screen.getByText('CS: member-cs').closest('a')).toBeNull();
    expect(screen.getByTitle('Couchsurfing')).toHaveTextContent('CS');
    expect(screen.getByTitle('Couchers.org')).toHaveTextContent('CO');
    expect(screen.getByTitle('BeWelcome')).toHaveTextContent('BW');
    expect(
      screen.queryByRole('link', { name: 'CS: member-cs' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'CS: member-cs' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Warmshowers' })).toHaveAttribute(
      'href',
      'https://app.warmshowers.org/profiles/00000000-0000-4000-8000-000000000001',
    );
    for (const [name, title] of [
      ['GitHub', 'GitHub'],
      ['Nostroots', 'Nostroots'],
      ['CO: member-couchers', 'Couchers.org'],
      ['BW: member-bw', 'BeWelcome'],
      ['Warmshowers', 'Warmshowers'],
    ]) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link.closest('li')).toHaveAttribute('title', title);
    }
  });

  it('confirms a Couchsurfing destination for an eligible viewer', () => {
    render(
      <ProfileViewBasics
        profile={makeProfile({ extSitesCS: 'fictional/handle?#' })}
        canOpenCouchsurfing
      />,
    );

    const trigger = screen.getByRole('button', {
      name: 'CS: fictional/handle?#',
    });
    expect(trigger).not.toHaveAttribute('href');
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', {
      name: 'Continue to Couchsurfing?',
    });
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Couchsurfing is run by a for-profit company that merely wants to extract value from its users without caring about privacy or community.',
    );
    const link = within(dialog).getByRole('link', {
      name: 'Open Couchsurfing in a new tab',
    });
    expect(link).toHaveAttribute(
      'href',
      'https://www.couchsurfing.com/people/fictional%2Fhandle%3F%23',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
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

  it('renders Warmshowers profile UUIDs and volunteer alumni labels', () => {
    render(
      <ProfileViewBasics
        profile={makeProfile({
          created: '2020-01-01T00:00:00.000Z',
          extSitesWS: '00000000-0000-4000-8000-000000000002',
          isVolunteerAlumni: true,
          languages: [],
          seen: undefined,
        })}
      />,
    );

    expect(screen.getByText('Trustroots volunteer alumni')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Warmshowers' })).toHaveAttribute(
      'href',
      'https://app.warmshowers.org/profiles/00000000-0000-4000-8000-000000000002',
    );
  });

  it('renders zero reply rate without reply time', () => {
    render(
      <ProfileViewBasics
        profile={malformedFixture(
          makeProfile({
            created: '2020-01-01T00:00:00.000Z',
            languages: [],
            seen: undefined,
          }),
          { replyRate: '0%', replyTime: '' },
        )}
      />,
    );

    expect(screen.getByText('Reply rate 0%.')).toBeInTheDocument();
    expect(screen.queryByText(/^Replies within/)).not.toBeInTheDocument();
  });

  it('renders sparse profile fallback details without optional sections', () => {
    render(
      <ProfileViewBasics
        profile={malformedFixture(
          makeProfile({
            created: undefined,
            // Regression fixture: the API can return null for a provider entry.
            additionalProvidersData: {},
            languages: [],
            seen: undefined,
          }),
          { additionalProvidersData: { github: null } },
        )}
      />,
    );

    expect(screen.queryByText(/^Registered /)).not.toBeInTheDocument();
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
