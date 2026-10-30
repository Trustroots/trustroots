import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom';

import AdminUsernameChanges from '@/modules/admin/client/components/AdminUsernameChanges.component';
import * as api from '@/modules/admin/client/api/username-changes.api';

jest.mock('@/modules/core/client/react-app/auth', () =>
  jest.requireActual('@/testutils/client/auth.testutil').mockAuthModule(),
);

jest.mock('@/modules/admin/client/api/username-changes.api');

const mockedApi = jest.mocked(api);

function pageResult(
  changes: api.AdminUsernameChange[],
  hasNextPage = false,
  range: api.AdminUsernameChangeRange = '90d',
): api.AdminUsernameChangesPage {
  return { changes, page: 1, hasNextPage, range };
}

const recordedChange: api.AdminUsernameChange = {
  _id: 'user-1',
  currentUsername: 'sample-member',
  displayName: 'Sample Member',
  oldUsername: 'sample-old',
  newUsername: 'sample-member',
  changedAt: '2025-03-04T05:06:07.000Z',
  legacy: false,
};

afterEach(() => {
  jest.resetAllMocks();
  window.history.pushState({}, '', '/');
});

describe('<AdminUsernameChanges />', () => {
  it('shows the recorded old and new names, current member link and UTC time', async () => {
    mockedApi.getUsernameChanges.mockResolvedValueOnce(
      pageResult([recordedChange]),
    );

    render(<AdminUsernameChanges />);

    const table = await screen.findByRole('table', {
      name: 'Username changes',
    });
    expect(table).toHaveTextContent('sample-old');
    expect(table).toHaveTextContent('sample-member');
    expect(
      screen.getByRole('link', { name: 'sample-member (Sample Member)' }),
    ).toHaveAttribute('href', '/admin/user/sample-member');
    expect(table).toHaveTextContent('2025-03-04 05:06');
    expect(screen.getByText('Times in UTC.')).toBeVisible();
    expect(
      screen.queryByRole('navigation', { name: 'Username changes pages' }),
    ).not.toBeInTheDocument();
    expect(mockedApi.getUsernameChanges).toHaveBeenCalledWith(1, '90d');
  });

  it('identifies legacy changes with no recorded previous username', async () => {
    mockedApi.getUsernameChanges.mockResolvedValueOnce(
      pageResult(
        [
          {
            _id: 'user-2',
            currentUsername: 'current-member',
            oldUsername: null,
            newUsername: 'current-member',
            changedAt: '2024-03-04T05:06:07.000Z',
            legacy: true,
          },
        ],
        false,
        'all',
      ),
    );
    window.history.pushState({}, '', '/admin/username-changes?range=all');

    render(<AdminUsernameChanges />);

    const table = await screen.findByRole('table', {
      name: 'Username changes',
    });
    expect(table).toHaveTextContent('Not recorded');
    expect(table).toHaveTextContent('current-member');
    expect(mockedApi.getUsernameChanges).toHaveBeenCalledWith(1, 'all');
    expect(screen.getByLabelText('Date range')).toHaveValue('all');
  });

  it('moves between 50-change pages and resets pagination when range changes', async () => {
    mockedApi.getUsernameChanges
      .mockResolvedValueOnce(pageResult([recordedChange], true))
      .mockResolvedValueOnce({
        ...pageResult([], false),
        page: 2,
      })
      .mockResolvedValueOnce(pageResult([recordedChange], true))
      .mockResolvedValueOnce(pageResult([recordedChange], false, 'all'));

    render(<AdminUsernameChanges />);
    await screen.findByRole('link', { name: 'sample-member (Sample Member)' });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(mockedApi.getUsernameChanges).toHaveBeenLastCalledWith(2, '90d'),
    );
    expect(await screen.findByText('Nothing found…')).toBeVisible();
    expect(screen.getByText('Page 2')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    await waitFor(() =>
      expect(mockedApi.getUsernameChanges).toHaveBeenLastCalledWith(1, '90d'),
    );
    await screen.findByRole('link', { name: 'sample-member (Sample Member)' });

    fireEvent.change(screen.getByLabelText('Date range'), {
      target: { value: 'all' },
    });
    await waitFor(() =>
      expect(mockedApi.getUsernameChanges).toHaveBeenLastCalledWith(1, 'all'),
    );
    expect(window.location.search).toBe('?range=all');
  });

  it('removes the all-time query parameter when returning to 90 days', async () => {
    window.history.pushState({}, '', '/admin/username-changes?range=all');
    mockedApi.getUsernameChanges
      .mockResolvedValueOnce(pageResult([]))
      .mockResolvedValueOnce(pageResult([]));

    render(<AdminUsernameChanges />);
    expect(await screen.findByText('Nothing found…')).toBeVisible();

    fireEvent.change(screen.getByLabelText('Date range'), {
      target: { value: '90d' },
    });
    await waitFor(() =>
      expect(mockedApi.getUsernameChanges).toHaveBeenLastCalledWith(1, '90d'),
    );
    expect(window.location.search).toBe('');
  });

  it('ignores a stale response after the selected range changes', async () => {
    let resolveFirst!: (value: api.AdminUsernameChangesPage) => void;
    mockedApi.getUsernameChanges
      .mockReturnValueOnce(
        new Promise(resolve => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValueOnce(
        pageResult([
          {
            ...recordedChange,
            _id: 'fresh-user',
            currentUsername: 'fresh-member',
            newUsername: 'fresh-member',
          },
        ]),
      );

    render(<AdminUsernameChanges />);
    fireEvent.change(screen.getByLabelText('Date range'), {
      target: { value: 'all' },
    });

    const freshMember = await screen.findByRole('link', {
      name: 'fresh-member (Sample Member)',
    });
    await act(async () => {
      resolveFirst(pageResult([recordedChange]));
    });

    expect(freshMember).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'sample-member (Sample Member)' }),
    ).not.toBeInTheDocument();
  });

  it('ignores a stale failure after the selected range changes', async () => {
    let rejectFirst!: (error: Error) => void;
    mockedApi.getUsernameChanges
      .mockReturnValueOnce(
        new Promise((_, reject) => {
          rejectFirst = reject;
        }),
      )
      .mockResolvedValueOnce(
        pageResult([
          {
            ...recordedChange,
            _id: 'fresh-user',
            currentUsername: 'fresh-member',
            newUsername: 'fresh-member',
          },
        ]),
      );

    render(<AdminUsernameChanges />);
    fireEvent.change(screen.getByLabelText('Date range'), {
      target: { value: 'all' },
    });
    const freshMember = await screen.findByRole('link', {
      name: 'fresh-member (Sample Member)',
    });
    await act(async () => {
      rejectFirst(new Error('stale request failed'));
    });

    expect(freshMember).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders unavailable timestamps without throwing', async () => {
    mockedApi.getUsernameChanges.mockResolvedValueOnce(
      pageResult([
        {
          _id: 'member-no-date',
          currentUsername: 'member-no-date',
          oldUsername: null,
          newUsername: 'member-no-date',
          changedAt: '',
          legacy: true,
        },
        {
          _id: 'member-invalid-date',
          currentUsername: 'member-invalid-date',
          oldUsername: 'former-name',
          newUsername: 'member-invalid-date',
          changedAt: 'not-a-timestamp',
          legacy: false,
        },
      ]),
    );

    render(<AdminUsernameChanges />);

    const table = await screen.findByRole('table', {
      name: 'Username changes',
    });
    expect(within(table).getAllByText('—')).toHaveLength(2);
    expect(table).toHaveTextContent('Not recorded');
  });

  it('shows an empty state and a request error', async () => {
    mockedApi.getUsernameChanges.mockResolvedValueOnce(pageResult([]));
    const emptyView = render(<AdminUsernameChanges />);
    expect(await screen.findByText('Nothing found…')).toBeVisible();
    emptyView.unmount();

    mockedApi.getUsernameChanges.mockRejectedValueOnce(new Error('failed'));
    render(<AdminUsernameChanges />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load username change history.',
    );
  });
});
