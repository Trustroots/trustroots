import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';

import Avatar from '@/modules/users/client/components/Avatar.component';
import TimeAgo from '@/modules/core/client/components/TimeAgo';
import { userType } from '@/modules/users/client/users.prop-types';
import type { MessageThreadSummary, MessageUser } from '../api/messages.api';

type InboxThreadProps = { user: MessageUser; thread: MessageThreadSummary };

export default function InboxThread({ user, thread }: InboxThreadProps) {
  const { t } = useTranslation('messages');
  const otherUser = findOtherUser(user, thread);
  const haveReplied = thread.userFrom._id === user._id;
  const { read } = thread;

  return (
    <li
      className={`list-group-item threadlist-thread ${
        !read ? 'threadlist-thread-unread' : ''
      }`}
    >
      <a href={`/messages/${otherUser.username}?userId=${otherUser._id}`}>
        <div className="media">
          <div className="media-left">
            <Avatar user={otherUser} size={32} link={false} />
          </div>
          <div className="media-body">
            <small className="text-muted pull-right">
              {haveReplied && (
                <i className="icon-reply" title={t<string>('You replied')} />
              )}
              &nbsp;
              <TimeAgo date={new Date(thread.updated)} />
            </small>
            <span>{otherUser.displayName || t<string>('Unknown member')}</span>
            <br />
            <span
              className="text-muted threadlist-thread-excerpt"
              dangerouslySetInnerHTML={{ __html: thread.message.excerpt }}
            />
          </div>
        </div>
      </a>
    </li>
  );
}

InboxThread.propTypes = {
  user: userType.isRequired,
  thread: PropTypes.shape({
    read: PropTypes.bool.isRequired,
    updated: PropTypes.string.isRequired,
    userFrom: userType.isRequired,
    userTo: userType.isRequired,
    message: PropTypes.shape({
      excerpt: PropTypes.string.isRequired,
    }),
  }),
};

function findOtherUser(
  currentUser: MessageUser,
  thread: MessageThreadSummary,
): MessageUser {
  return [thread.userFrom, thread.userTo].find(
    user => user._id !== currentUser._id,
  )!;
}
