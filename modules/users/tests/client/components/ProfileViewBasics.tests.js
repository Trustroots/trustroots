import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import ProfileViewBasics from '@/modules/users/client/components/ProfileViewBasics';

jest.mock('@/modules/users/client/components/LanguageList', () => {
  const React = require('react');

  function MockLanguageList({ className, languages }) {
    return (
      <ul className={className}>
        {languages.map(language => (
          <li key={language}>{`language-${language}`}</li>
        ))}
      </ul>
    );
  }

  MockLanguageList.propTypes = {
    className: () => null,
    languages: () => null,
  };

  return MockLanguageList;
});

jest.mock(
  '@/modules/users/client/components/ProfileNostrBadge.component',
  () => {
    const React = require('react');

    function MockProfileNostrBadge({ npubHex }) {
      return (
        <div data-testid="profile-nostr-badge">{npubHex || 'no-npub-hex'}</div>
      );
    }

    MockProfileNostrBadge.propTypes = {
      npubHex: () => null,
    };

    return MockProfileNostrBadge;
  },
);

describe('<ProfileViewBasics />', () => {
  it('renders member profile basics, locations, languages, and networks', () => {
    render(
      <ProfileViewBasics
        profile={{
          additionalProvidersData: {
            facebook: { id: 'hidden-facebook-id' },
            github: { login: 'trustroots' },
          },
          birthdate: '1990-06-01T00:00:00.000Z',
          created: '2020-01-01T00:00:00.000Z',
          extSitesBW: 'bewelcome-user',
          extSitesCS: 'couchsurfing-user',
          extSitesCouchers: 'couchers-user',
          extSitesWS: '12345',
          gender: 'female',
          isVolunteer: true,
          languages: ['en', 'pt'],
          locationFrom: 'Lisbon',
          locationLiving: 'Helsinki',
          nostrNpub: 'npub1trustroots',
          replyRate: '80%',
          replyTime: '2020-01-02T00:00:00.000Z',
          seen: '2020-01-03T00:00:00.000Z',
          username: 'trustroots',
        }}
      />,
    );

    expect(screen.getByText('Trustroots volunteer')).toBeInTheDocument();
    expect(screen.getByText('Reply rate 80%.')).toBeInTheDocument();
    expect(screen.getByText(/Female\./)).toBeInTheDocument();
    expect(screen.getByText(/Member since/)).toBeInTheDocument();
    expect(screen.getByText(/Online/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Helsinki' })).toHaveAttribute(
      'href',
      '/search?location=Helsinki',
    );
    expect(screen.getByRole('link', { name: 'Lisbon' })).toHaveAttribute(
      'href',
      '/search?location=Lisbon',
    );
    expect(screen.getByText('language-en')).toBeInTheDocument();
    expect(screen.getByText('language-pt')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/trustroots',
    );
    expect(
      screen.queryByRole('link', { name: 'Facebook' }),
    ).not.toBeInTheDocument();
    const nostrLink = screen.getByRole('link', { name: 'Nostroots' });
    expect(nostrLink).toHaveAttribute(
      'href',
      'https://nos.trustroots.org/v0/#profile/trustroots%40trustroots.org',
    );
    expect(nostrLink).toHaveAttribute(
      'aria-describedby',
      'nostr-address-note-trustroots',
    );
    expect(
      nostrLink.closest('li').querySelector('.nostroots-logo'),
    ).toHaveAttribute('src', '/img/external/nostroots-logo.png');
    expect(screen.getByText('Nostr address, not an email address')).toHaveClass(
      'sr-only',
    );
    expect(screen.getByRole('link', { name: 'Couchers.org' })).toHaveAttribute(
      'href',
      'https://couchers.org/user/couchers-user',
    );
    expect(screen.getByRole('link', { name: 'BeWelcome' })).toHaveAttribute(
      'href',
      'https://www.bewelcome.org/members/bewelcome-user',
    );
    expect(screen.getByRole('link', { name: 'Couchsurfing' })).toHaveAttribute(
      'href',
      'https://www.couchsurfing.com/people/couchsurfing-user',
    );
    expect(screen.getByRole('link', { name: 'Warmshowers' })).toHaveAttribute(
      'href',
      'https://www.warmshowers.org/user/12345',
    );
  });

  it('renders the nostr npub fallback link when it is the only network', () => {
    render(
      <ProfileViewBasics
        profile={{
          created: '2020-01-01T00:00:00.000Z',
          languages: [],
          nostrNpub: 'npub1onlynetwork',
          seen: null,
        }}
      />,
    );

    expect(screen.getByText('Elsewhere')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nostroots' })).toHaveAttribute(
      'href',
      'https://nos.trustroots.org/v0/#profile/npub1onlynetwork',
    );
  });

  it('passes valid npub identifiers to the Nostroots badge as hex', () => {
    render(
      <ProfileViewBasics
        profile={{
          created: '2020-01-01T00:00:00.000Z',
          languages: [],
          nostrNpub:
            'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzqujme',
          seen: null,
        }}
      />,
    );

    expect(screen.getByTestId('profile-nostr-badge')).toHaveTextContent(
      '0000000000000000000000000000000000000000000000000000000000000000',
    );
  });

  it('passes null badge data for non-npub Nostr identifiers', () => {
    render(
      <ProfileViewBasics
        profile={{
          created: '2020-01-01T00:00:00.000Z',
          languages: [],
          nostrNpub:
            'note1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqn2l0z3',
          seen: null,
        }}
      />,
    );

    expect(screen.getByTestId('profile-nostr-badge')).toHaveTextContent(
      'no-npub-hex',
    );
  });

  it('renders Warmshowers usernames and volunteer alumni labels', () => {
    render(
      <ProfileViewBasics
        profile={{
          created: '2020-01-01T00:00:00.000Z',
          extSitesWS: 'warmshowers-user',
          isVolunteerAlumni: true,
          languages: [],
          seen: null,
        }}
      />,
    );

    expect(screen.getByText('Trustroots volunteer alumni')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Warmshowers' })).toHaveAttribute(
      'href',
      'https://www.warmshowers.org/users/warmshowers-user',
    );
  });

  it('renders sparse profile fallback details without optional sections', () => {
    render(
      <ProfileViewBasics
        profile={{
          created: '2020-01-01T00:00:00.000Z',
          languages: [],
          seen: null,
        }}
      />,
    );

    expect(screen.getByText(/Member since/)).toBeInTheDocument();
    expect(screen.getByText('Online long ago')).toBeInTheDocument();
    expect(screen.queryByText('Languages')).not.toBeInTheDocument();
    expect(screen.queryByText('Elsewhere')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Nostroots' }),
    ).not.toBeInTheDocument();
  });
});
