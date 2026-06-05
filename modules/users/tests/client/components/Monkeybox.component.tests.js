import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import Monkeybox from '@/modules/users/client/components/Monkeybox';

jest.mock('@/modules/users/client/components/LanguageList', () => {
  const React = require('react');

  function MockLanguageList({ languages }) {
    return (
      <ul>
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

const tribe = {
  _id: 'tribe-1',
  slug: 'hitchhikers',
  label: 'Hitchhikers',
};

function makeUser(overrides = {}) {
  return {
    _id: 'alice',
    username: 'alice',
    displayName: 'Alice Example',
    languages: ['en'],
    member: [{ tribe }],
    ...overrides,
  };
}

describe('<Monkeybox />', () => {
  it('renders the user, languages, and tribes in common', () => {
    const otherUser = {
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
    const otherUser = {
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
