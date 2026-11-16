import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import SearchUsers from '@/modules/search/client/components/SearchUsers.component';
import type { UserProfile } from '@/modules/users/client/types';

type MockSearchResponse = { data: UserProfile[] | null };
const mockSearchUsers = jest.fn<Promise<MockSearchResponse>, [query: string]>();

jest.mock('@tanstack/react-router', () =>
  jest.requireActual('@/testutils/client/router-location.testutil'),
);
jest.mock('@/modules/users/client/api/search-users.api.js', () => ({
  searchUsers: (query: string) => mockSearchUsers(query),
}));

afterEach(() => {
  jest.clearAllMocks();
});

describe('<SearchUsers />', () => {
  beforeEach(() => {
    window.history.pushState({}, 'Search', '/search');
  });

  it('keeps search controls disabled until the query is long enough', () => {
    render(<SearchUsers />);

    const input = screen.getByRole('textbox', { name: 'Search members' });
    expect(input).not.toHaveFocus();
    expect(input).toHaveAttribute('maxlength', '120');
    const searchButton = screen.getByRole('button', {
      name: 'Search members',
    });
    const clearButton = screen.getByRole('button', {
      name: 'Clear members search',
    });

    expect(searchButton).toBeDisabled();
    expect(clearButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'al' } });

    expect(searchButton).toBeDisabled();
    expect(clearButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'ali' } });

    expect(searchButton).toBeEnabled();
    expect(clearButton).toBeEnabled();
  });

  it('submits a member search and renders user results', async () => {
    mockSearchUsers.mockResolvedValueOnce({
      data: [
        {
          _id: 'user-1',
          avatarSource: 'none',
          displayName: 'Alice Example',
          username: 'alice',
        },
      ],
    });

    render(<SearchUsers />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Search members' }), {
      target: { value: 'alice' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search members' }));

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(
      screen.getByRole('heading', { name: 'Searching members…' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(mockSearchUsers).toHaveBeenCalledWith('alice'));

    expect(await screen.findByText('1 members found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Alice Example/ })).toHaveAttribute(
      'href',
      '/profile/alice',
    );
  });

  it('runs an initial search from the URL search parameter', async () => {
    window.history.pushState({}, 'Search', '/search?search=traveler');
    mockSearchUsers.mockResolvedValueOnce({ data: [] });

    render(<SearchUsers />);

    expect(screen.getByRole('textbox', { name: 'Search members' })).toHaveValue(
      'traveler',
    );
    await waitFor(() =>
      expect(mockSearchUsers).toHaveBeenCalledWith('traveler'),
    );
    expect(await screen.findByText('No members found.')).toBeInTheDocument();
  });

  it('shows empty results when the search response has no users array', async () => {
    mockSearchUsers.mockResolvedValueOnce({ data: null });

    render(<SearchUsers />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Search members' }), {
      target: { value: 'alice' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search members' }));

    await waitFor(() => expect(mockSearchUsers).toHaveBeenCalledWith('alice'));
    expect(await screen.findByText('No members found.')).toBeInTheDocument();
  });

  it('does not request users for short URL searches', () => {
    window.history.pushState({}, 'Search', '/search?search=ab');

    render(<SearchUsers />);

    expect(mockSearchUsers).not.toHaveBeenCalled();
    expect(screen.getByText('No members found.')).toBeInTheDocument();
  });

  it('clears the current query and rendered results', async () => {
    mockSearchUsers.mockResolvedValueOnce({
      data: [
        {
          _id: 'user-1',
          avatarSource: 'none',
          displayName: 'Alice Example',
          username: 'alice',
        },
      ],
    });

    render(<SearchUsers />);

    const input = screen.getByRole('textbox', { name: 'Search members' });
    fireEvent.change(input, { target: { value: 'alice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search members' }));

    expect(await screen.findByText('1 members found')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Clear members search' }),
    );

    expect(input).toHaveValue('');
    expect(screen.queryByText('1 members found')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Search members' }),
    ).toBeDisabled();
  });

  it('announces a failed search and retries accessibly', async () => {
    mockSearchUsers
      .mockRejectedValueOnce(new Error('Search failed'))
      .mockResolvedValueOnce({
        data: [
          {
            _id: 'user-1',
            avatarSource: 'none',
            displayName: 'Alice Example',
            username: 'alice',
          },
        ],
      });

    render(<SearchUsers />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Search members' }), {
      target: { value: 'alice' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search members' }));

    await waitFor(() => expect(mockSearchUsers).toHaveBeenCalledWith('alice'));
    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('Member search unavailable');
    expect(error).toHaveTextContent('Could not search members.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('1 members found')).toBeInTheDocument();
    expect(mockSearchUsers).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('No members found.')).not.toBeInTheDocument();
  });
});
