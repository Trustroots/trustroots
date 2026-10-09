import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import Monkeybox from '@/modules/users/client/components/Monkeybox';
import type LanguageList from '@/modules/users/client/components/LanguageList';

jest.mock('@/modules/users/client/components/LanguageList', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockLanguageList({
    languages = [],
  }: React.ComponentProps<typeof LanguageList>) {
    return (
      <ul>
        {languages.map(language => (
          <li key={language}>{`language-${language}`}</li>
        ))}
      </ul>
    );
  }

  return MockLanguageList;
});

type MonkeyboxUser = React.ComponentProps<typeof Monkeybox>['user'];

type MonkeyboxTribe = MonkeyboxUser['member'][number]['tribe'];
const tribeWithoutCount: Omit<MonkeyboxTribe, 'count'> = {
  _id: 'tribe-1',
  slug: 'hitchhikers',
  label: 'Hitchhikers',
};
// Preserve the original sparse API fixture: this component only reads these
// fields, and the missing count is part of the runtime shape under test.
const tribe = tribeWithoutCount as MonkeyboxTribe;

function makeUser(overrides: Partial<MonkeyboxUser> = {}): MonkeyboxUser {
  return {
    _id: 'alice',
    username: 'alice',
    displayName: 'Alice Example',
    languages: ['en'],
    member: [{ tribe }],
    memberIds: [],
    ...overrides,
  };
}

describe('<Monkeybox />', () => {
  it('renders the user, languages, and tribes in common', () => {
    const otherUser: MonkeyboxUser = {
      _id: 'bob',
      username: 'bob',
      displayName: 'Bob Example',
      memberIds: ['tribe-1'],
      member: [],
      languages: [],
    };

    render(<Monkeybox user={makeUser()} otherUser={otherUser} />);

    expect(screen.getByRole('link', { name: 'Alice Example' })).toHaveAttribute(
      'href',
      '/profile/alice',
    );
    expect(screen.getByText('Languages')).toBeInTheDocument();
    expect(screen.getByText('language-en')).toBeInTheDocument();
    expect(screen.getByText('Circles in common')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Hitchhikers' })).toHaveAttribute(
      'href',
      '/circles/hitchhikers',
    );
  });

  it('hides tribes in common and languages when there are none', () => {
    const otherUser: MonkeyboxUser = {
      _id: 'charlie',
      username: 'charlie',
      displayName: 'Charlie Example',
      memberIds: [],
      member: [],
      languages: [],
    };

    render(
      <Monkeybox
        user={makeUser({ languages: [], member: [{ tribe }] })}
        otherUser={otherUser}
      />,
    );

    expect(screen.queryByText('Circles in common')).not.toBeInTheDocument();
    expect(screen.queryByText('Languages')).not.toBeInTheDocument();
  });
});
