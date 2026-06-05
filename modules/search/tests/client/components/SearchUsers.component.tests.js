import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import SearchUsers from '@/modules/search/client/components/SearchUsers.component';
import { searchUsers } from '@/modules/users/client/api/search-users.api.js';

jest.mock('@/modules/users/client/api/search-users.api.js', () => ({
  searchUsers: jest.fn(),
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
    searchUsers.mockResolvedValueOnce({
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

    expect(screen.getByRole('alertdialog')).toHaveTextContent('Wait a moment');
    await waitFor(() => expect(searchUsers).toHaveBeenCalledWith('alice'));

    expect(await screen.findByText('1 members found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alice Example' })).toHaveAttribute(
      'href',
      '/profile/alice',
    );
  });

  it('runs an initial search from the URL search parameter', async () => {
    window.history.pushState({}, 'Search', '/search?search=traveler');
    searchUsers.mockResolvedValueOnce({ data: [] });

    render(<SearchUsers />);

    expect(screen.getByRole('textbox', { name: 'Search members' })).toHaveValue(
      'traveler',
    );
    await waitFor(() => expect(searchUsers).toHaveBeenCalledWith('traveler'));
    expect(
      await screen.findByText('No members found by this name.'),
    ).toBeInTheDocument();
  });

  it('does not request users for short URL searches', () => {
    window.history.pushState({}, 'Search', '/search?search=ab');

    render(<SearchUsers />);

    expect(searchUsers).not.toHaveBeenCalled();
    expect(
      screen.getByText('No members found by this name.'),
    ).toBeInTheDocument();
  });

  it('clears the current query and rendered results', async () => {
    searchUsers.mockResolvedValueOnce({
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

  it('hides loading state and shows empty results after a failed search', async () => {
    searchUsers.mockRejectedValueOnce(new Error('Search failed'));

    render(<SearchUsers />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Search members' }), {
      target: { value: 'alice' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search members' }));

    await waitFor(() => expect(searchUsers).toHaveBeenCalledWith('alice'));
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
    expect(
      screen.getByText('No members found by this name.'),
    ).toBeInTheDocument();
  });
});
