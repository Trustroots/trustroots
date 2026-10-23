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
import AdminThreads from '@/modules/admin/client/components/AdminThreads.component';
import {
  getThreads,
  type AdminThread,
} from '@/modules/admin/client/api/threads.api';
import { getUser } from '@/modules/admin/client/api/users.api';

jest.mock('@/modules/admin/client/api/threads.api');
jest.mock('@/modules/admin/client/api/users.api');
const threads = jest.mocked(getThreads);
const user = jest.mocked(getUser);
const id = '111111111111111111111111';
const alice = { _id: id, username: 'alice', displayName: 'Alice Example' };
const bob = {
  _id: '222222222222222222222222',
  username: 'bob',
  displayName: 'Bob Example',
};
const thread: AdminThread = {
  _id: 'thread-1',
  read: false,
  updated: '2026-10-20T18:30:00Z',
  firstMessage: '2026-10-01T08:09:10Z',
  lastMessage: '2026-10-20T18:30:45Z',
  userFromProfile: [alice],
  userToProfile: [bob],
  votes: [
    { _id: 'vote-1', userFrom: alice._id, userTo: bob._id, reference: 'yes' },
    { _id: 'vote-2', userFrom: bob._id, userTo: alice._id, reference: 'no' },
  ],
};
beforeEach(() => {
  jest.resetAllMocks();
  window.history.replaceState({}, '', '/admin/threads?username=alice');
  threads.mockResolvedValue([thread]);
});
afterEach(() => window.history.replaceState({}, '', '/'));

test('shows a readable thread table with directional votes and exact UTC minute timestamps', async () => {
  render(<AdminThreads />);
  const table = await screen.findByRole('table', { name: 'Threads' });
  expect(threads).toHaveBeenCalledWith({ username: 'alice' });
  expect(user).not.toHaveBeenCalled();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByText('Thread details')).not.toBeInTheDocument();
  expect(
    within(table)
      .getAllByRole('columnheader')
      .map(th => th.textContent),
  ).toEqual([
    'From',
    'To',
    'Status',
    'Thread votes',
    'First message',
    'Last message',
    'Conversation',
  ]);
  expect(screen.getByText('2026-10-01 08:09')).toHaveAttribute(
    'dateTime',
    '2026-10-01T08:09:10.000Z',
  );
  expect(screen.getByText('2026-10-20 18:30')).toBeInTheDocument();
  expect(screen.getByText(/alice → bob:/)).toHaveTextContent('positive');
  expect(screen.getByText(/bob → alice:/)).toHaveTextContent('negative');
  expect(screen.getByText('Unread')).toHaveClass('label-warning');
  expect(screen.getByRole('link', { name: 'Read thread' })).toHaveAttribute(
    'href',
    '/admin/messages?username1=alice&username2=bob',
  );
});

test('resolves legacy identifier links to a username even for an empty inbox', async () => {
  window.history.replaceState({}, '', `/admin/threads?userId=${id}`);
  user.mockResolvedValue({ profile: alice });
  threads.mockResolvedValue([]);
  render(<AdminThreads />);
  expect(await screen.findByText('Nothing found…')).toBeInTheDocument();
  expect(user).toHaveBeenCalledWith(id);
  expect(window.location.search).toBe('?username=alice');
  expect(threads).toHaveBeenCalledWith({ username: 'alice' });
});

test('treats a hex-shaped username as a username and prefers it over a legacy id', async () => {
  window.history.replaceState(
    {},
    '',
    `/admin/threads?username=${id}&userId=${bob._id}`,
  );
  render(<AdminThreads />);
  await screen.findByRole('table');
  expect(threads).toHaveBeenCalledWith({ username: id });
  expect(user).not.toHaveBeenCalled();
});

test('shows an instruction with no member and does not query', () => {
  window.history.replaceState({}, '', '/admin/threads');
  render(<AdminThreads />);
  expect(screen.getByText(/Open a member’s threads/)).toBeInTheDocument();
  expect(threads).not.toHaveBeenCalled();
});

test.each([[], null])('handles empty thread payloads: %j', async result => {
  threads.mockResolvedValue(result as unknown as AdminThread[]);
  render(<AdminThreads />);
  expect(await screen.findByText('Nothing found…')).toBeInTheDocument();
});

test('shows read state and placeholders without inventing dates, votes or links for deleted members', async () => {
  threads.mockResolvedValue([
    {
      ...thread,
      read: true,
      firstMessage: null,
      lastMessage: 'invalid',
      votes: [],
      userFromProfile: [],
      userToProfile: [],
    },
  ]);
  render(<AdminThreads />);
  const table = await screen.findByRole('table');
  expect(screen.getByText('Read')).toHaveClass('label-success');
  expect(within(table).getAllByText('—')).toHaveLength(4);
  expect(
    screen.queryByRole('link', { name: 'Read thread' }),
  ).not.toBeInTheDocument();
});

test.each(['invalid', 'missing', 'failed'])(
  'handles a %s legacy member',
  async kind => {
    window.history.replaceState(
      {},
      '',
      `/admin/threads?userId=${kind === 'invalid' ? 'wrong-id' : id}`,
    );
    if (kind === 'failed') user.mockRejectedValue(new Error('Unavailable'));
    else user.mockResolvedValue({ profile: {} });
    render(<AdminThreads />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load threads',
    );
    expect(threads).not.toHaveBeenCalled();
  },
);

test('shows a request error', async () => {
  threads.mockRejectedValue(new Error('Unavailable'));
  render(<AdminThreads />);
  expect(await screen.findByRole('alert')).toBeInTheDocument();
});

test('ignores thread results after leaving the page', async () => {
  let resolve!: (value: AdminThread[]) => void;
  threads.mockImplementation(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const view = render(<AdminThreads />);
  await waitFor(() => expect(threads).toHaveBeenCalled());
  view.unmount();
  await act(async () => resolve([thread]));
});

test('does not replace the URL after a legacy member lookup finishes on an abandoned page', async () => {
  window.history.replaceState({}, '', `/admin/threads?userId=${id}`);
  let resolve!: (value: unknown) => void;
  user.mockImplementation(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const view = render(<AdminThreads />);
  await waitFor(() => expect(user).toHaveBeenCalled());
  view.unmount();
  window.history.replaceState({}, '', '/admin');
  await act(async () => resolve({ profile: alice }));
  expect(window.location.pathname).toBe('/admin');
  expect(threads).not.toHaveBeenCalled();
});

test('ignores an error returned after leaving the page', async () => {
  let reject!: (reason: Error) => void;
  threads.mockImplementation(
    () =>
      new Promise((resolve, fail) => {
        reject = fail;
      }),
  );
  const view = render(<AdminThreads />);
  view.unmount();
  await act(async () => reject(new Error('Unavailable')));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('retains votes when a participant has been deleted', async () => {
  threads.mockResolvedValue([
    { ...thread, userFromProfile: [], userToProfile: [] },
  ]);
  render(<AdminThreads />);
  await screen.findByRole('table');
  expect(screen.getByText('positive').closest('li')).toHaveTextContent(
    'Deleted member → Deleted member: positive',
  );
  expect(screen.getByText('negative').closest('li')).toHaveTextContent(
    'Deleted member → Deleted member: negative',
  );
});

const voteCases = [
  ['received-positive', bob._id, alice._id, 'yes'],
  ['received-negative', bob._id, alice._id, 'no'],
  ['given-positive', alice._id, bob._id, 'yes'],
  ['given-negative', alice._id, bob._id, 'no'],
] as const;
const votedThreads: AdminThread[] = voteCases.map(
  ([filter, userFrom, userTo, reference], index) => ({
    ...thread,
    _id: filter,
    // The last message direction must not determine the vote direction.
    userFromProfile: index % 2 ? [bob] : [alice],
    userToProfile: index % 2 ? [alice] : [bob],
    votes: [{ _id: `vote-${index}`, userFrom, userTo, reference }],
  }),
);

test.each(voteCases)('opens only threads with %s votes', async filter => {
  window.history.replaceState(
    {},
    '',
    `/admin/threads?username=alice&vote=${filter}`,
  );
  threads.mockResolvedValue([
    ...votedThreads,
    { ...thread, _id: 'without-votes', votes: undefined },
  ]);
  render(<AdminThreads />);
  const table = await screen.findByRole('table', { name: 'Threads' });
  expect(screen.getByLabelText('Filter by thread vote')).toHaveValue(filter);
  expect(within(table).getAllByRole('row')).toHaveLength(2);
  const selected = votedThreads.find(item => item._id === filter)!;
  expect(
    within(table).getByText(
      selected.votes![0].reference === 'yes' ? 'positive' : 'negative',
    ),
  ).toBeInTheDocument();
});

test('changes and clears the vote filter and preserves the member URL', async () => {
  threads.mockResolvedValue(votedThreads);
  render(<AdminThreads />);
  const table = await screen.findByRole('table');
  expect(within(table).getAllByRole('row')).toHaveLength(5);
  fireEvent.change(screen.getByLabelText('Filter by thread vote'), {
    target: { value: 'given-negative' },
  });
  expect(within(table).getAllByRole('row')).toHaveLength(2);
  expect(window.location.search).toBe('?username=alice&vote=given-negative');
  fireEvent.change(screen.getByLabelText('Filter by thread vote'), {
    target: { value: '' },
  });
  expect(within(table).getAllByRole('row')).toHaveLength(5);
  expect(window.location.search).toBe('?username=alice');
  expect(threads).toHaveBeenCalledTimes(1);
});

test('shows an empty result for unmatched votes and keeps a legacy link filter during username resolution', async () => {
  window.history.replaceState(
    {},
    '',
    `/admin/threads?userId=${id}&vote=received-positive`,
  );
  user.mockResolvedValue({ profile: alice });
  render(<AdminThreads />);
  expect(await screen.findByText('Nothing found…')).toBeInTheDocument();
  expect(window.location.search).toBe('?vote=received-positive&username=alice');
});

test('ignores an unknown vote filter', async () => {
  window.history.replaceState(
    {},
    '',
    '/admin/threads?username=alice&vote=unknown',
  );
  render(<AdminThreads />);
  await screen.findByRole('table');
  expect(screen.getByLabelText('Filter by thread vote')).toHaveValue('');
});

test('does not attribute a vote to a missing member profile', async () => {
  window.history.replaceState(
    {},
    '',
    '/admin/threads?username=alice&vote=given-positive',
  );
  threads.mockResolvedValue([{ ...thread, userFromProfile: [] }]);
  render(<AdminThreads />);
  expect(await screen.findByText('Nothing found…')).toBeInTheDocument();
});
