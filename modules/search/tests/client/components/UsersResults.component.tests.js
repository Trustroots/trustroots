import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import '@/config/client/i18n';
import UsersResults from '@/modules/search/client/components/UsersResults';
const member = {
  _id: 'member-1',
  username: 'alex',
  displayName: 'Alex Example',
  avatarSource: 'none',
  locationLiving: 'Exampleville',
  locationFrom: 'Sampleton',
  tagline: 'Learning pottery',
};
it('shows public context and matching fields', () => {
  render(<UsersResults users={[member]} query="Exampleville" />);
  expect(screen.getByText('Lives in: Exampleville')).toBeInTheDocument();
  expect(screen.getByText('From: Sampleton')).toBeInTheDocument();
  expect(screen.getByText('Learning pottery')).toBeInTheDocument();
  expect(screen.getByText('@alex')).toBeInTheDocument();
  expect(screen.getByText('Matches: Lives in')).toBeInTheDocument();
});
it('identifies name, username and tagline matches', () => {
  render(<UsersResults users={[member]} query="alex pottery" />);
  expect(
    screen.getByText('Matches: Name, Username, Tagline'),
  ).toBeInTheDocument();
});
it('handles missing fields and an empty query', () => {
  render(
    <UsersResults
      users={[
        {
          _id: 'member-2',
          username: 'sam',
          displayName: 'Sam Example',
          avatarSource: 'none',
        },
      ]}
    />,
  );
  expect(screen.queryByText(/Matches:/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Lives in:/)).not.toBeInTheDocument();
});
it.each([[], null])('shows empty results', users => {
  render(<UsersResults users={users} />);
  expect(screen.getByText('No members found.')).toBeInTheDocument();
});
it('does not claim a literal match for an indexed stemming match', () => {
  render(<UsersResults users={[member]} query="learned" />);
  expect(screen.queryByText(/Matches:/)).not.toBeInTheDocument();
});
it('handles punctuation-only queries safely', () => {
  render(<UsersResults users={[member]} query="---" />);
  expect(screen.queryByText(/Matches:/)).not.toBeInTheDocument();
});
