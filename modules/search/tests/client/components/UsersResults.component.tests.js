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
  expect(
    screen.getByText(
      (_, element) =>
        element.tagName === 'P' &&
        element.textContent === 'Lives in: Exampleville',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      (_, element) =>
        element.tagName === 'P' && element.textContent === 'From: Sampleton',
    ),
  ).toBeInTheDocument();
  expect(screen.getByText('Learning pottery')).toBeInTheDocument();
  expect(screen.getByText('@alex')).toBeInTheDocument();
  expect(screen.getByText('Exampleville').tagName).toBe('STRONG');
  expect(screen.queryByText(/Matches:/)).not.toBeInTheDocument();
});
it('highlights matches in names, usernames and taglines', () => {
  render(<UsersResults users={[member]} query="alex pottery" />);
  expect(screen.getByText('Alex').tagName).toBe('STRONG');
  expect(screen.getByText('alex').tagName).toBe('STRONG');
  expect(screen.getByText('pottery').tagName).toBe('STRONG');
});
it('merges overlapping query matches and preserves unmatched punctuation', () => {
  const { unmount } = render(
    <UsersResults
      users={[{ ...member, displayName: 'Alex Example' }]}
      query="Alex Alex Ex"
    />,
  );
  expect(
    screen.getAllByText((_, element) => element.tagName === 'STRONG'),
  ).toHaveLength(4);
  expect(
    screen
      .getAllByText((_, element) => element.tagName === 'STRONG')
      .map(element => element.textContent),
  ).toEqual(['Alex', 'Ex', 'alex', 'Ex']);

  unmount();
  render(<UsersResults users={[member]} query="---" />);
  expect(screen.queryByText(/Matches:/)).not.toBeInTheDocument();
  expect(screen.getByText('Alex Example').tagName).not.toBe('STRONG');
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
it('links the query to map search and shows initials without an image', () => {
  render(<UsersResults users={[member]} query="Exampleville & coast" />);
  expect(
    screen.getByRole('link', { name: 'Search this place on the map' }),
  ).toHaveAttribute('href', '/search?location=Exampleville%20%26%20coast');
  expect(screen.getByText('AE')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Alex Example/ })).toHaveAttribute(
    'href',
    '/profile/alex',
  );
});
it('offers map search when the member search has no results', () => {
  render(<UsersResults users={[]} query="Lost Coast" />);
  expect(
    screen.getByRole('link', { name: 'Search this place on the map' }),
  ).toHaveAttribute('href', '/search?location=Lost%20Coast');
});
it('does not claim a literal match for an indexed stemming match', () => {
  render(<UsersResults users={[member]} query="learned" />);
  expect(screen.queryByText(/Matches:/)).not.toBeInTheDocument();
});
it('handles punctuation-only queries safely', () => {
  render(<UsersResults users={[member]} query="---" />);
  expect(screen.queryByText(/Matches:/)).not.toBeInTheDocument();
});
