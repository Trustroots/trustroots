import { useTranslation } from 'react-i18next';
import React from 'react';

import Avatar from '@/modules/users/client/components/Avatar.component';
import TimeAgo from '@/modules/core/client/components/TimeAgo';
import type { MessageThreadSummary, MessageUser } from '../api/messages.api';

type InboxThreadProps = { user: MessageUser; thread: MessageThreadSummary };

export default function InboxThread({ user, thread }: InboxThreadProps) {
  const { t } = useTranslation('messages');
  const otherUser = findOtherUser(user, thread);
  const haveReplied = thread.userFrom?._id === user._id;
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
                <i className="icon-reply" title={t('You replied')} />
              )}
              &nbsp;
              <TimeAgo date={new Date(thread.updated)} />
            </small>
            <span>{otherUser.displayName || t('Unknown member')}</span>
            <br />
            <span className="text-muted threadlist-thread-excerpt">
              {thread.message.excerpt}
            </span>
          </div>
        </div>
      </a>
    </li>
  );
}

function findOtherUser(
  currentUser: MessageUser,
  thread: MessageThreadSummary,
): MessageUser {
  const otherUser =
    thread.userFrom?._id === currentUser._id ? thread.userTo : thread.userFrom;
  return otherUser ?? { _id: '', displayName: 'Unknown member' };
}
