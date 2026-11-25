import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import AdminThreads from '@/modules/admin/client/components/AdminThreads.component';
import {
  getThreads,
  type AdminThread,
} from '@/modules/admin/client/api/threads.api';
import { getUser } from '@/modules/admin/client/api/users.api';

vi.mock('@/modules/core/client/react-app/auth', async () =>
  (await import('@/testutils/client/auth.testutil')).mockAuthModule(),
);
vi.mock('@tanstack/react-router', async () =>
  (
    await import('@/testutils/client/router-location.testutil')
  ).mockRouterModule(),
);

vi.mock('@/modules/admin/client/api/threads.api');
vi.mock('@/modules/admin/client/api/users.api');
const threads = vi.mocked(getThreads);
const user = vi.mocked(getUser);
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
    {
      _id: 'vote-1',
      userFrom: alice._id,
      userTo: bob._id,
      reference: 'yes',
      created: '2026-10-23T08:09:11+01:00',
    },
    { _id: 'vote-2', userFrom: bob._id, userTo: alice._id, reference: 'no' },
  ],
};
beforeEach(() => {
  vi.resetAllMocks();
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
      .map(th => th.getAttribute('scope')),
  ).toEqual(Array(7).fill('col'));
  expect(
    within(table)
      .getAllByRole('button')
      .map(button => button.textContent?.trim()),
  ).toEqual([
    'From ↕',
    'To ↕',
    'Status ↕',
    'Thread votes ↕',
    'First message ↕',
    'Last message ↕',
  ]);
  expect(
    within(table).getByRole('columnheader', { name: 'Conversation' }),
  ).not.toHaveAttribute('aria-sort');
  expect(screen.getByText('2026-10-01 08:09')).toHaveAttribute(
    'dateTime',
    '2026-10-01T08:09:10.000Z',
  );
  expect(screen.getByText('2026-10-20 18:30')).toBeInTheDocument();
  const positive = within(screen.getByText(/alice → bob:/));
  expect(positive.getByText('positive vote')).toHaveClass('tw:sr-only');
  expect(positive.getByText('+')).toHaveAttribute('aria-hidden', 'true');
  expect(positive.getByText('2026-10-23 07:09')).toHaveAttribute(
    'datetime',
    '2026-10-23T07:09:11.000Z',
  );
  const negative = within(screen.getByText(/bob → alice:/));
  expect(negative.getByText('negative vote')).toHaveClass('tw:sr-only');
  expect(negative.getByText('−')).toHaveAttribute('aria-hidden', 'true');
  expect(negative.getByText('negative vote').closest('li')).toHaveTextContent(
    '· —',
  );
  expect(screen.getByText('Unread')).toHaveAttribute('data-intent', 'warning');
  expect(screen.getByRole('link', { name: 'Read thread' })).toHaveAttribute(
    'href',
    '/admin/messages?username1=alice&username2=bob',
  );
});

test('sorts every data column in both directions and retains the username', async () => {
  const cara = { _id: '333333333333333333333333', username: 'cara' };
  const zara = { _id: '444444444444444444444444', username: 'Zara' };
  threads.mockResolvedValue([
    {
      ...thread,
      _id: 'cara-thread',
      userFromProfile: [bob],
      userToProfile: [cara],
      read: true,
      firstMessage: '2026-10-01T08:00:00Z',
      lastMessage: '2026-10-01T18:00:00Z',
      votes: Array.from({ length: 11 }, (_, index) => ({
        ...thread.votes![0],
        _id: `cara-vote-${index}`,
      })),
    },
    {
      ...thread,
      _id: 'zara-thread',
      userFromProfile: [],
      userToProfile: [zara],
      firstMessage: null,
      lastMessage: '2026-10-01T17:30:00-01:00',
    },
    {
      ...thread,
      _id: 'bob-thread',
      userFromProfile: [{ _id: cara._id, displayName: 'Dana' }],
      read: true,
      firstMessage: '2026-10-01T08:30:00+01:00',
      lastMessage: 'invalid',
      votes: undefined,
    },
  ]);
  render(<AdminThreads />);
  const table = await screen.findByRole('table');
  const recipients = () =>
    within(table)
      .getAllByRole('row')
      .slice(1)
      .map(
        row => within(row).getAllByRole('cell')[1].textContent?.split(' ')[0],
      );
  expect(recipients()).toEqual(['cara', 'Zara', 'bob']);

  const cases = [
    ['From', ['cara', 'bob', 'Zara'], ['Zara', 'bob', 'cara']],
    ['To', ['bob', 'cara', 'Zara'], ['Zara', 'cara', 'bob']],
    ['Status', ['cara', 'bob', 'Zara'], ['Zara', 'cara', 'bob']],
    ['Thread votes', ['bob', 'Zara', 'cara'], ['cara', 'Zara', 'bob']],
    ['First message', ['Zara', 'bob', 'cara'], ['cara', 'bob', 'Zara']],
    ['Last message', ['bob', 'cara', 'Zara'], ['Zara', 'cara', 'bob']],
  ] as const;
  for (const [label, ascending, descending] of cases) {
    const button = within(table).getByRole('button', { name: label });
    const header = within(table).getByRole('columnheader', { name: label });
    fireEvent.click(button);
    expect(header).toHaveAttribute('aria-sort', 'ascending');
    expect(button).toHaveTextContent('↑');
    expect(recipients()).toEqual(ascending);
    fireEvent.click(button);
    expect(header).toHaveAttribute('aria-sort', 'descending');
    expect(button).toHaveTextContent('↓');
    expect(recipients()).toEqual(descending);
    expect(table.querySelectorAll('th[aria-sort]')).toHaveLength(1);
  }
  expect(window.location.search).toBe('?username=alice');
  expect(threads).toHaveBeenCalledTimes(1);
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

test.each([[[]], [null]])('handles empty thread payloads: %j', async result => {
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
  expect(screen.getByText('Read')).toHaveAttribute('data-intent', 'success');
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
  expect(screen.getByText('positive vote').closest('li')).toHaveTextContent(
    'Deleted member → Deleted member: +positive vote',
  );
  expect(screen.getByText('negative vote').closest('li')).toHaveTextContent(
    'Deleted member → Deleted member: −negative vote',
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
      selected.votes![0].reference === 'yes'
        ? 'positive vote'
        : 'negative vote',
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
