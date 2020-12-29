// External dependencies
import React, { useState } from 'react';

// Internal dependencies
import { getMessages } from '../api/messages.api';
import AdminHeader from './AdminHeader.component';
import Json from './Json.component';
import UserLink from './UserLink.component';
import TimeAgo from '@/modules/core/client/components/TimeAgo';

// Mongo ObjectId is always 24 chars long
const MONGO_OBJECT_ID_LENGTH = 24;

export default function AdminMessages() {
  // @TODO: replace with useLocation of react-router or similar.
  const urlParams = new URLSearchParams(window.location.search);
  const urlUserId1 = urlParams.get('userId1');
  const urlUserId2 = urlParams.get('userId2');
  const initialUserId1 =
    urlUserId1 && urlUserId1.length === MONGO_OBJECT_ID_LENGTH
      ? urlUserId1
      : '';
  const initialUserId2 =
    urlUserId2 && urlUserId2.length === MONGO_OBJECT_ID_LENGTH
      ? urlUserId2
      : '';

  const [queried, setQueried] = useState(false);
  const [messages, setMessages] = useState([]);
  const [userId1, setUserId1] = useState(initialUserId1);
  const [userId2, setUserId2] = useState(initialUserId2);

  async function onSubmit(event) {
    event.preventDefault();
    if (
      userId1 &&
      userId2 &&
      userId1.length === MONGO_OBJECT_ID_LENGTH &&
      userId2.length === MONGO_OBJECT_ID_LENGTH
    ) {
      const messages = await getMessages(userId1, userId2);
      setMessages(messages);
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
            aria-label="Member 1 ID"
            className="form-control input-lg"
            maxLength={MONGO_OBJECT_ID_LENGTH}
            name="userId1"
            onChange={({ target: { value } }) => setUserId1(value)}
            placeholder="Member 1 ID"
            size={MONGO_OBJECT_ID_LENGTH + 2}
            type="text"
            value={userId1}
          />
          <input
            aria-label="Member 2 ID"
            className="form-control input-lg"
            maxLength={MONGO_OBJECT_ID_LENGTH}
            name="userId2"
            onChange={({ target: { value } }) => setUserId2(value)}
            placeholder="Member 2 ID"
            size={MONGO_OBJECT_ID_LENGTH + 2}
            type="text"
            value={userId2}
          />
          <button
            className="btn btn-lg btn-default"
            disabled={
              userId1.length !== MONGO_OBJECT_ID_LENGTH &&
              userId2.length !== MONGO_OBJECT_ID_LENGTH
            }
            type="submit"
          >
            Read
          </button>
        </form>

        {!queried && messages.length === 0 && (
          <p>
            <em className="text-muted">
              {userId1 && userId2 ? 'Press "Read"' : 'Choose two members…'}
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
