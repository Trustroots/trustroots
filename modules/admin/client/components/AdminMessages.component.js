// External dependencies
import React, { useState } from 'react';

// Internal dependencies
import { getMessages } from '../api/messages.api';
import { searchUsers } from '../api/users.api';
import AdminHeader from './AdminHeader.component';
import AdminReferenceVoteItem from './AdminReferenceVoteItem.component';
import Json from './Json.component';
import UserLink from './UserLink.component';
import {
  MONGO_OBJECT_ID_LENGTH,
  resolveExactMemberId,
} from './userSearch.helpers';
import TimeAgo from '@/modules/core/client/components/TimeAgo';

export default function AdminMessages() {
  // @TODO: replace with useLocation of react-router or similar.
  const urlParams = new URLSearchParams(window.location.search);
  const urlUserId1 = urlParams.get('userId1');
  const urlUserId2 = urlParams.get('userId2');
  const initialMember1 = urlUserId1 || '';
  const initialMember2 = urlUserId2 || '';

  const [queried, setQueried] = useState(false);
  const [messages, setMessages] = useState([]);
  const [referenceThreads, setReferenceThreads] = useState([]);
  const [member1, setMember1] = useState(initialMember1);
  const [member2, setMember2] = useState(initialMember2);

  async function onSubmit(event) {
    event.preventDefault();
    if (member1 && member2) {
      const userId1 = await resolveExactMemberId(member1, searchUsers, [
        'username',
      ]);
      const userId2 = await resolveExactMemberId(member2, searchUsers, [
        'username',
      ]);
      if (!userId1 || !userId2) {
        setMessages([]);
        setReferenceThreads([]);
        setQueried(true);
        return;
      }

      const result = await getMessages(userId1, userId2);
      setMessages(Array.isArray(result) ? result : result.messages || []);
      setReferenceThreads(
        Array.isArray(result) ? [] : result.referenceThreads || [],
      );
      setQueried(true);
    }
  }

  return (
    <>
      <AdminHeader />
      <div className="container">
        <h2>Messages</h2>

        <form className="form-inline" onSubmit={event => onSubmit(event)}>
          <input
            aria-label="Member 1 username or ID"
            className="form-control input-lg"
            name="member1"
            onChange={({ target: { value } }) => setMember1(value)}
            placeholder="Member 1 username or ID"
            size={MONGO_OBJECT_ID_LENGTH + 2}
            type="text"
            value={member1}
          />
          <input
            aria-label="Member 2 username or ID"
            className="form-control input-lg"
            name="member2"
            onChange={({ target: { value } }) => setMember2(value)}
            placeholder="Member 2 username or ID"
            size={MONGO_OBJECT_ID_LENGTH + 2}
            type="text"
            value={member2}
          />
          <button
            className="btn btn-lg btn-default"
            disabled={!member1.trim() || !member2.trim()}
            type="submit"
          >
            Read
          </button>
        </form>

        {!queried && messages.length === 0 && (
          <p>
            <em className="text-muted">
              {member1 && member2 ? 'Press "Read"' : 'Choose two members…'}
            </em>
          </p>
        )}

        {queried && messages.length > 0 && (
          <>
            <h3>
              Messaging between <UserLink user={messages[0].userFrom} />
              {' & '}
              <UserLink user={messages[0].userTo} />
            </h3>
            {referenceThreads.length > 0 && (
              <div className="alert alert-warning">
                <strong>Thread votes</strong>
                <ul>
                  {referenceThreads.map(referenceThread => (
                    <AdminReferenceVoteItem
                      key={referenceThread._id}
                      referenceThread={referenceThread}
                    />
                  ))}
                </ul>
              </div>
            )}
            {messages.map(message => {
              const { _id } = message;
              return (
                <div className="panel panel-default" key={_id}>
                  <div className="panel-body">
                    <UserLink user={message.userFrom} />
                    {' · '}
                    <TimeAgo date={new Date(message.created)} />
                    {' · '}
                    {message.read ? 'Seen.' : 'Not seen.'}
                    <br />
                    <br />
                    <div
                      dangerouslySetInnerHTML={{ __html: message.content }}
                    />
                    <br />
                    <details>
                      <summary>Database entry</summary>
                      <Json content={message} />
                    </details>
                  </div>
                </div>
              );
            })}
          </>
        )}
        {queried && messages.length === 0 && (
          <div className="alert alert-info">
            <em>Nothing found…</em>
          </div>
        )}
      </div>
    </>
  );
}

AdminMessages.propTypes = {};
