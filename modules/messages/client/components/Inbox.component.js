import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import { $broadcast } from '@/modules/core/client/services/angular-compat';

import * as api from '../api/messages.api';
import Avatar from '@/modules/users/client/components/Avatar.component';
import Activate from '@/modules/users/client/components/Activate';
import { eventTrack } from '@/modules/core/client/services/angular-compat';

const userType = PropTypes.shape({
  _id: PropTypes.string.isRequired,
  username: PropTypes.string.isRequired,
  displayName: PropTypes.string.isRequired,
});

export default function Inbox({ user }) {
  if (!user.public) {
    return (
      <section className="container-spacer">
        <Activate/>
      </section>
    );
  }
  const [nextParams, setNextParams] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [threads, setThreads] = useState([]);

  const hasMore = Boolean(nextParams);

  async function fetchThreads(next = false) {
    setIsFetching(true);
    try {
      if (next) {
        eventTrack('inbox-pagination', {
          category: 'messages.inbox',
          label: 'Inbox page ' + nextParams,
        });
      }

      const data = await api.fetchThreads(next ? nextParams : {});
      setThreads(threads => next ? threads.concat(data.threads) : data.threads);
      setNextParams(data.nextParams);
    } finally {
      setIsFetching(false);
    }
  }

  useEffect(() => {
    // Tell unread-messages directive to sync itself
    $broadcast('syncUnreadMessagesCount');
    fetchThreads();
  }, []);

  return <section className="container-spacer">
    {!isFetching && threads.length === 0 && (
      <div className="content-empty">
        <i className="icon-3x icon-messages-alt"/>
        <h4 role="alert">No conversations yet.</h4>
      </div>
    )}
    {threads.length > 0 && (
      <ul className="list-group threadlist">
        {threads.map(thread => (
          <InboxThread
            key={thread._id}
            user={user}
            thread={thread}
          />
        ))}
      </ul>
    )}
    {!isFetching && hasMore && (
      <div className="text-center">
        <button
          className="btn btn-primary btn-lg"
          onClick={() => fetchThreads(true)}
        >
          More messages
        </button>
      </div>
    )}
  </section>;
}

Inbox.propTypes = {
  user: userType.isRequired,
};

function InboxThread({ user, thread }) {
  const otherUser = findOtherUser(user, thread);
  const haveReplied = thread.userFrom._id = user._id;
  const updated = moment(thread.updated);
  return <li className="list-group-item threadlist-thread">
    <a href={`/messages/${otherUser.username}`}>
      <div className="media">
        <div className="media-left">
          <Avatar user={otherUser} size={32} link={false}/>
        </div>
        <div className="media-body">
          <small className="text-muted pull-right">
            {haveReplied && <i className="icon-reply" title="You replied"/>}
            &nbsp;
            {/* @TODO: these are not reactive */}
            <span title={updated.toString()}>{updated.fromNow()}</span>
          </small>
          <span>{otherUser.displayName || 'Unknown member'}</span>
          <br/>
          <span
            className="text-muted threadlist-thread-excerpt"
            dangerouslySetInnerHTML={{ __html: thread.message.excerpt }}
          />
        </div>
      </div>
    </a>
  </li>;
}

InboxThread.propTypes = {
  user: userType.isRequired,
  thread: PropTypes.shape({
    updated: PropTypes.string.isRequired,
    userFrom: userType.isRequired,
    userTo: userType.isRequired,
    message: PropTypes.shape({
      excerpt: PropTypes.string.isRequired,
    }),
  }),
};

function findOtherUser(currentUser, thread) {
  return [thread.userFrom, thread.userTo].find(user => user._id !== currentUser._id);
}
