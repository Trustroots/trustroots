import React, { useEffect, useState } from 'react';
import { Badge } from '@trustroots/ui/Badge';
import { getThreads, type AdminThread } from '../api/threads.api';
import { getUser } from '../api/users.api';
import AdminHeader from './AdminHeader.component';
import UserLink from './UserLink.component';
import { isMongoObjectId } from './userSearch.helpers';
import { formatAdminDateTime } from '../utils/admin-date';

function MessageTime({ value }: { value?: string | null }) {
  if (!value || Number.isNaN(new Date(value).getTime())) return <>—</>;
  const date = new Date(value).toISOString();
  return <time dateTime={date}>{formatAdminDateTime(value)}</time>;
}

export default function AdminThreads() {
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const [voteFilter, setVoteFilter] = useState(() => {
    const value = params.get('vote') || '';
    return [
      'received-positive',
      'received-negative',
      'given-positive',
      'given-negative',
    ].includes(value)
      ? value
      : '';
  });
  const [username, setUsername] = useState(params.get('username') || '');
  const [threads, setThreads] = useState<AdminThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const requestedUsername = params.get('username');
  const legacyId = params.get('userId');

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
          const url = new URL(window.location.href);
          url.searchParams.delete('userId');
          url.searchParams.set('username', name);
          window.history.replaceState(window.history.state, '', url);
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

  return (
    <>
      <AdminHeader />
      <div className="container">
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
          <label>
            Filter by thread vote
            <select
              className="form-control"
              value={voteFilter}
              onChange={event => {
                const value = event.target.value;
                setVoteFilter(value);
                const url = new URL(window.location.href);
                if (value) url.searchParams.set('vote', value);
                else url.searchParams.delete('vote');
                window.history.replaceState(window.history.state, '', url);
              }}
            >
              <option value="">All threads</option>
              <option value="received-positive">Positive votes received</option>
              <option value="received-negative">Negative votes received</option>
              <option value="given-positive">Positive votes given</option>
              <option value="given-negative">Negative votes given</option>
            </select>
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
                      <th scope="col">From</th>
                      <th scope="col">To</th>
                      <th scope="col">Status</th>
                      <th scope="col">Thread votes</th>
                      <th scope="col">First message</th>
                      <th scope="col">Last message</th>
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
                              <Badge variant="solid" tone="success">
                                Read
                              </Badge>
                            ) : (
                              <Badge variant="solid" tone="warning">
                                Unread
                              </Badge>
                            )}
                          </td>
                          <td>
                            {thread.votes?.length ? (
                              <ul className="list-unstyled">
                                {thread.votes.map(vote => {
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
                                          vote.reference === 'yes'
                                            ? 'text-success'
                                            : 'text-danger'
                                        }
                                      >
                                        {vote.reference === 'yes'
                                          ? 'positive'
                                          : 'negative'}
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            <MessageTime value={thread.firstMessage} />
                          </td>
                          <td>
                            <MessageTime value={thread.lastMessage} />
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
