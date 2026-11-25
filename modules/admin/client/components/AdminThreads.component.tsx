import { Select } from '@trustroots/ui/Select';
import { Button } from '@trustroots/ui/Button';
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Badge } from '@trustroots/ui/Badge';
import { getThreads, type AdminThread } from '../api/threads.api';
import { getUser } from '../api/users.api';
import AdminHeader from './AdminHeader.component';
import UserLink from './UserLink.component';
import { isMongoObjectId } from './userSearch.helpers';
import {
  formatAdminDateTime,
  getAdminDateTimeAttribute,
} from '../utils/admin-date';

function ThreadTime({ value }: { value?: string | null }) {
  const dateTime = getAdminDateTimeAttribute(value);
  if (!dateTime) return <>—</>;
  return <time dateTime={dateTime}>{formatAdminDateTime(value)}</time>;
}

function participantName(profile?: AdminThread['userFromProfile'][number]) {
  return profile?.username || profile?.displayName || 'Unknown member';
}

function messageTimestamp(value?: string | null) {
  const timestamp = Date.parse(value ?? '');
  return Number.isNaN(timestamp) ? Number.MIN_SAFE_INTEGER : timestamp;
}

function voteCount(thread: AdminThread) {
  return thread.votes?.length ?? 0;
}

const collator = new Intl.Collator('en', { sensitivity: 'base' });
const sortColumns: Array<{
  label: string;
  compare: (first: AdminThread, second: AdminThread) => number;
}> = [
  {
    label: 'From',
    compare: (first, second) =>
      collator.compare(
        participantName(first.userFromProfile[0]),
        participantName(second.userFromProfile[0]),
      ),
  },
  {
    label: 'To',
    compare: (first, second) =>
      collator.compare(
        participantName(first.userToProfile[0]),
        participantName(second.userToProfile[0]),
      ),
  },
  {
    label: 'Status',
    compare: (first, second) => Number(!first.read) - Number(!second.read),
  },
  {
    label: 'Thread votes',
    compare: (first, second) => voteCount(first) - voteCount(second),
  },
  {
    label: 'First message',
    compare: (first, second) =>
      messageTimestamp(first.firstMessage) -
      messageTimestamp(second.firstMessage),
  },
  {
    label: 'Last message',
    compare: (first, second) =>
      messageTimestamp(first.lastMessage) -
      messageTimestamp(second.lastMessage),
  },
];

export default function AdminThreads() {
  const params = useSearch({ strict: false });
  const navigate = useNavigate();
  const [voteFilter, setVoteFilter] = useState(() => {
    const value = params.vote || '';
    return [
      'received-positive',
      'received-negative',
      'given-positive',
      'given-negative',
    ].includes(value)
      ? value
      : '';
  });
  const [username, setUsername] = useState(params.username || '');
  const [threads, setThreads] = useState<AdminThread[]>([]);
  const [sort, setSort] = useState<{
    column: (typeof sortColumns)[number];
    direction: 'ascending' | 'descending';
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const requestedUsername = params.username;
  const legacyId = params.userId;

  useEffect(() => {
    if (!requestedUsername && !legacyId) return;
    let active = true;
    setLoading(true);
    setFailed(false);
    async function load() {
      try {
        let name = requestedUsername;
        if (!name) {
          if (!isMongoObjectId(legacyId)) throw new Error('Invalid member.');
          const member = await getUser(legacyId!);
          name = member.profile?.username;
          if (!name) throw new Error('Member not found.');
          if (!active) return;
          void navigate({
            hash: true,
            replace: true,
            search: (search: Record<string, string>) => ({
              ...search,
              userId: undefined,
              username: name,
            }),
            to: '/admin/threads',
          });
        }
        const result = await getThreads({ username: name });
        if (active) {
          setUsername(name);
          setThreads(result || []);
        }
      } catch {
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [requestedUsername, legacyId]);

  const filteredThreads = threads.filter(thread => {
    if (!voteFilter) return true;
    const [direction, sentiment] = voteFilter.split('-');
    const member = [...thread.userFromProfile, ...thread.userToProfile].find(
      profile => profile.username === username,
    );
    return thread.votes?.some(
      vote =>
        vote[direction === 'received' ? 'userTo' : 'userFrom'] ===
          member?._id &&
        vote.reference === (sentiment === 'positive' ? 'yes' : 'no'),
    );
  });
  if (sort) {
    const { column, direction } = sort;
    const multiplier = direction === 'ascending' ? 1 : -1;
    filteredThreads.sort(
      (first, second) => multiplier * column.compare(first, second),
    );
  }

  return (
    <>
      <AdminHeader />
      <div className="tw:page-container">
        <h2>Threads</h2>
        {username && (
          <p>
            Messages from/to <strong>{username}</strong>
          </p>
        )}
        {!requestedUsername && !legacyId && (
          <p>Open a member’s threads from their account page.</p>
        )}
        {(requestedUsername || legacyId) && (
          <label htmlFor="thread-vote">
            Filter by thread vote
            <Select
              id="thread-vote"
              value={voteFilter}
              onChange={event => {
                const value = event.target.value;
                setVoteFilter(value);
                void navigate({
                  hash: true,
                  replace: true,
                  search: (search: Record<string, string>) => ({
                    ...search,
                    vote: value || undefined,
                  }),
                  to: '/admin/threads',
                });
              }}
            >
              <option value="">All threads</option>
              <option value="received-positive">Positive votes received</option>
              <option value="received-negative">Negative votes received</option>
              <option value="given-positive">Positive votes given</option>
              <option value="given-negative">Negative votes given</option>
            </Select>
          </label>
        )}
        {loading && <p role="status">Loading threads…</p>}
        {failed && (
          <p role="alert">Unable to load threads. Please try again.</p>
        )}
        {!loading &&
          !failed &&
          (requestedUsername || legacyId) &&
          (filteredThreads.length === 0 ? (
            <p>Nothing found…</p>
          ) : (
            <>
              <p className="text-muted">Times in UTC.</p>
              <div className="table-responsive">
                <table
                  className="table table-striped admin-threads-table"
                  aria-label="Threads"
                >
                  <thead>
                    <tr>
                      {sortColumns.map(column => {
                        const direction =
                          sort?.column === column ? sort.direction : undefined;
                        return (
                          <th
                            key={column.label}
                            scope="col"
                            aria-sort={direction}
                          >
                            <Button
                              variant="link"
                              size="sm"
                              type="button"
                              onClick={() =>
                                setSort({
                                  column,
                                  direction:
                                    direction === 'ascending'
                                      ? 'descending'
                                      : 'ascending',
                                })
                              }
                            >
                              {column.label}{' '}
                              <span aria-hidden="true">
                                {direction === 'ascending'
                                  ? '↑'
                                  : direction === 'descending'
                                    ? '↓'
                                    : '↕'}
                              </span>
                            </Button>
                          </th>
                        );
                      })}
                      <th scope="col">Conversation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredThreads.map(thread => {
                      const from = thread.userFromProfile[0];
                      const to = thread.userToProfile[0];
                      return (
                        <tr key={thread._id}>
                          <td>
                            <UserLink user={from} />
                          </td>
                          <td>
                            <UserLink user={to} />
                          </td>
                          <td>
                            {thread.read ? (
                              <Badge variant="solid" intent="success">
                                Read
                              </Badge>
                            ) : (
                              <Badge variant="solid" intent="warning">
                                Unread
                              </Badge>
                            )}
                          </td>
                          <td>
                            {thread.votes?.length ? (
                              <ul className="list-unstyled">
                                {thread.votes.map(vote => {
                                  const positive = vote.reference === 'yes';
                                  const author = [from, to].find(
                                    member => member?._id === vote.userFrom,
                                  );
                                  const recipient = [from, to].find(
                                    member => member?._id === vote.userTo,
                                  );
                                  return (
                                    <li key={vote._id}>
                                      {author?.username || 'Deleted member'} →{' '}
                                      {recipient?.username || 'Deleted member'}:{' '}
                                      <span
                                        className={
                                          positive
                                            ? 'text-success'
                                            : 'text-danger'
                                        }
                                      >
                                        <span aria-hidden="true">
                                          {positive ? '+' : '−'}
                                        </span>
                                        <span className="tw:sr-only">
                                          {positive
                                            ? 'positive vote'
                                            : 'negative vote'}
                                        </span>
                                      </span>
                                      {' · '}
                                      <ThreadTime value={vote.created} />
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            <ThreadTime value={thread.firstMessage} />
                          </td>
                          <td>
                            <ThreadTime value={thread.lastMessage} />
                          </td>
                          <td>
                            {from?.username && to?.username ? (
                              <a
                                href={`/admin/messages?username1=${encodeURIComponent(from.username)}&username2=${encodeURIComponent(to.username)}`}
                              >
                                Read thread
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ))}
      </div>
    </>
  );
}
