import React from 'react';
import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  NetworkConnectionSearchPage,
  NetworkConnectionsPanel,
} from '@/modules/admin/client/components/NetworkConnections.component';
import * as api from '@/modules/admin/client/api/network-connections.api';
import type { Network } from '@/modules/users/shared/network-connections';

jest.mock('@/modules/admin/client/api/network-connections.api', () => ({
  getMemberNetworkConnections: jest.fn(),
  searchNetworkConnections: jest.fn(),
}));

const getMemberNetworkConnections = jest.mocked(
  api.getMemberNetworkConnections,
);
const searchNetworkConnections = jest.mocked(api.searchNetworkConnections);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const memberPage = {
  current: [
    { network: 'bewelcome' as const, identifier: 'member-17' },
    { network: 'unknown-network' as Network, identifier: 'unlinked-id' },
  ],
  history: [
    {
      network: 'unknown-network' as Network,
      oldIdentifier: null,
      newIdentifier: 'unlinked-id',
      changedAt: '2026-02-01T12:00:00Z',
      initial: false,
    },
    {
      network: 'servas' as const,
      oldIdentifier: 'household/../bad',
      newIdentifier: null,
      changedAt: '2026-02-02T12:00:00Z',
      initial: false,
    },
    {
      network: 'nostr' as const,
      oldIdentifier: null,
      newIdentifier: 'npub-old',
      changedAt: '2026-02-03T12:00:00Z',
      initial: true,
    },
    {
      network: 'nostr' as const,
      oldIdentifier: 'npub-old',
      newIdentifier: null,
      changedAt: null,
      initial: false,
    },
  ],
  page: 1,
  hasNextPage: true,
};

afterEach(() => jest.resetAllMocks());
beforeEach(() => {
  window.user = { roles: ['support-team'] };
});
afterEach(() => {
  delete window.user;
});

test('shows current connections and history with paging', async () => {
  getMemberNetworkConnections
    .mockResolvedValueOnce(memberPage)
    .mockResolvedValueOnce({
      ...memberPage,
      current: [],
      history: [],
      page: 2,
      hasNextPage: false,
    })
    .mockResolvedValueOnce(memberPage);
  render(<NetworkConnectionsPanel memberId="member-1" />);
  expect(screen.getByRole('status')).toHaveTextContent(
    'Loading connection history',
  );
  expect(
    await screen.findByRole('link', { name: 'member-17' }),
  ).toHaveAttribute('href', 'https://www.bewelcome.org/members/member-17');
  expect(screen.getByText('unknown-network: unlinked-id')).toBeInTheDocument();
  expect(screen.getAllByRole('row')[1]).toHaveTextContent('unknown-network');
  expect(screen.getByText('Unknown (initial snapshot)')).toBeInTheDocument();
  expect(
    screen
      .getAllByRole('link', { name: 'npub-old' })
      .every(
        link =>
          link.getAttribute('href') ===
          'https://nos.trustroots.org/v0/#profile/npub-old',
      ),
  ).toBe(true);
  expect(screen.getAllByRole('cell', { name: 'Removed' })).toHaveLength(2);
  expect(screen.getByText('household/../bad')).toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: 'household/../bad' }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() =>
    expect(getMemberNetworkConnections).toHaveBeenLastCalledWith('member-1', 2),
  );
  expect(
    await screen.findByText('No current external connections.'),
  ).toBeInTheDocument();
  expect(screen.getByText('Page 2')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
  await waitFor(() =>
    expect(getMemberNetworkConnections).toHaveBeenLastCalledWith('member-1', 1),
  );
});

test('shows an empty history and a load error', async () => {
  getMemberNetworkConnections.mockResolvedValueOnce({
    current: [],
    history: [],
    page: 1,
    hasNextPage: false,
  });
  const view = render(<NetworkConnectionsPanel memberId="member-empty" />);
  expect(await screen.findByText('No connection history.')).toBeInTheDocument();
  view.unmount();
  getMemberNetworkConnections.mockRejectedValueOnce(new Error('offline'));
  render(<NetworkConnectionsPanel memberId="member-error" />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unable to load connection history.',
  );
});

test('ignores member requests that finish after the panel unmounts', async () => {
  const success =
    deferred<Awaited<ReturnType<typeof api.getMemberNetworkConnections>>>();
  getMemberNetworkConnections.mockReturnValueOnce(success.promise);
  const successView = render(
    <NetworkConnectionsPanel memberId="member-late" />,
  );
  successView.unmount();
  await act(async () => {
    success.resolve(memberPage);
    await success.promise;
  });

  const failure =
    deferred<Awaited<ReturnType<typeof api.getMemberNetworkConnections>>>();
  getMemberNetworkConnections.mockReturnValueOnce(failure.promise);
  const failureView = render(
    <NetworkConnectionsPanel memberId="member-late" />,
  );
  failureView.unmount();
  await act(async () => {
    failure.reject(new Error('offline'));
    await failure.promise.catch(() => undefined);
  });
});

test('searches identifiers, links matching members and pages results', async () => {
  searchNetworkConnections
    .mockResolvedValueOnce({
      members: [
        {
          _id: 'member-1',
          username: 'fictional-member',
          displayName: 'Fictional Member',
          identifier: 'sample-id',
          current: true,
        },
      ],
      page: 1,
      hasNextPage: true,
    })
    .mockResolvedValueOnce({
      members: [
        {
          _id: 'member-2',
          username: 'past-member',
          displayName: 'Past Member',
          identifier: 'npub-old',
          current: false,
        },
      ],
      page: 2,
      hasNextPage: false,
    })
    .mockResolvedValueOnce({ members: [], page: 1, hasNextPage: false });
  render(<NetworkConnectionSearchPage />);
  fireEvent.change(screen.getByLabelText('Network'), {
    target: { value: 'nostr' },
  });
  fireEvent.change(screen.getByLabelText('Identifier'), {
    target: { value: ' NPUB-EXAMPLE ' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  expect(
    await screen.findByRole('link', {
      name: 'fictional-member (Fictional Member)',
    }),
  ).toHaveAttribute('href', '/admin/support/member/fictional-member');
  expect(searchNetworkConnections).toHaveBeenCalledWith(
    'nostr',
    'npub-example',
    1,
  );
  expect(screen.getByText('Current')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Network'), {
    target: { value: 'github' },
  });
  expect(screen.getByRole('link', { name: 'sample-id' })).toHaveAttribute(
    'href',
    'https://nos.trustroots.org/v0/#profile/sample-id',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(
    await screen.findByRole('link', { name: 'past-member (Past Member)' }),
  ).toBeInTheDocument();
  expect(searchNetworkConnections).toHaveBeenLastCalledWith(
    'nostr',
    'npub-example',
    2,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
  expect(await screen.findByText('No matching members.')).toBeInTheDocument();
});

test('shows search errors', async () => {
  searchNetworkConnections.mockRejectedValueOnce(new Error('offline'));
  render(<NetworkConnectionSearchPage />);
  fireEvent.change(screen.getByLabelText('Identifier'), {
    target: { value: 'fictional-id' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unable to search external connections.',
  );
});

test('ignores searches that finish after the page unmounts', async () => {
  const success =
    deferred<Awaited<ReturnType<typeof api.searchNetworkConnections>>>();
  searchNetworkConnections.mockReturnValueOnce(success.promise);
  const successView = render(<NetworkConnectionSearchPage />);
  fireEvent.change(screen.getByLabelText('Identifier'), {
    target: { value: 'fictional-id' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  await waitFor(() => expect(searchNetworkConnections).toHaveBeenCalled());
  successView.unmount();
  await act(async () => {
    success.resolve({ members: [], page: 1, hasNextPage: false });
    await success.promise;
  });

  const failure =
    deferred<Awaited<ReturnType<typeof api.searchNetworkConnections>>>();
  searchNetworkConnections.mockReturnValueOnce(failure.promise);
  const failureView = render(<NetworkConnectionSearchPage />);
  fireEvent.change(screen.getByLabelText('Identifier'), {
    target: { value: 'another-fictional-id' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  await waitFor(() =>
    expect(searchNetworkConnections).toHaveBeenCalledTimes(2),
  );
  failureView.unmount();
  await act(async () => {
    failure.reject(new Error('offline'));
    await failure.promise.catch(() => undefined);
  });
});

test('rejects a profile URL that does not match the selected network', async () => {
  render(<NetworkConnectionSearchPage />);
  fireEvent.change(screen.getByLabelText('Network'), {
    target: { value: 'servas' },
  });
  fireEvent.change(screen.getByLabelText('Identifier'), {
    target: { value: 'https://servas.org/not-a-member-profile' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Enter a valid identifier or profile URL for this network.',
  );
  expect(searchNetworkConnections).not.toHaveBeenCalled();
});
