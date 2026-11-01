import React, { useCallback, useEffect, useState } from 'react';

import { getMessages } from '../api/messages.api';
import { getUser, searchUsers } from '../api/users.api';
import {
  formatAdminDateTime,
  getAdminDateTimeAttribute,
} from '../utils/admin-date';
import AdminHeader from './AdminHeader.component';
import AdminReferenceVoteItem from './AdminReferenceVoteItem.component';
import { isExactUserMatch, isMongoObjectId } from './userSearch.helpers';
import MessageBubble from '@/modules/messages/client/components/MessageBubble';
import RichText from '@/modules/core/client/components/RichText';
import Avatar from '@/modules/users/client/components/Avatar.component';
import UserLink from './UserLink.component';
import { Alert } from '@trustroots/ui/Alert';

interface AdminUser {
  _id: string;
  username?: string;
  displayName?: string;
  roles?: string[];
  profile?: {
    _id?: string;
    username?: string;
    displayName?: string;
    roles?: string[];
  };
}

interface AdminMessage {
  _id: string;
  userFrom?: AdminUser | null;
  userTo?: AdminUser | null;
  created?: string | number | Date | null;
  read: boolean;
  content: string;
}

interface ReferenceThread {
  _id: string;
  [key: string]: unknown;
}

interface MessagesResponse {
  messages: AdminMessage[];
  referenceThreads?: ReferenceThread[];
}

async function resolveUsername(username: string): Promise<AdminUser | null> {
  const result = await searchUsers(username);
  const users = Array.isArray(result) ? result : result.users || [];
  return (
    users.find((user: AdminUser) =>
      isExactUserMatch(username, user, ['username']),
    ) || null
  );
}

async function resolveLegacyId(id: string): Promise<AdminUser | null> {
  if (!isMongoObjectId(id)) return null;
  const user = await getUser(id);
  if (!user) return null;
  return {
    ...user,
    _id: user._id || user.profile?._id || id,
    username: user.username || user.profile?.username,
    displayName: user.displayName || user.profile?.displayName,
  };
}

function MessageTimestamp({
  value,
}: {
  value?: string | number | Date | null;
}) {
  const dateTime = getAdminDateTimeAttribute(value);
  if (!dateTime) return <span>—</span>;
  return <time dateTime={dateTime}>{formatAdminDateTime(value)}</time>;
}

export default function AdminMessages() {
  const [initialParams] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      username1: params.get('username1') || '',
      username2: params.get('username2') || '',
      userId1: params.get('userId1') || '',
      userId2: params.get('userId2') || '',
    };
  });
  const member1Value = initialParams.username1 || initialParams.userId1;
  const member2Value = initialParams.username2 || initialParams.userId2;
  const member1IsUsername = Boolean(initialParams.username1);
  const member2IsUsername = Boolean(initialParams.username2);

  const [queried, setQueried] = useState(false);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [referenceThreads, setReferenceThreads] = useState<ReferenceThread[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const runQuery = useCallback(
    async (isActive: () => boolean) => {
      if (!member1Value || !member2Value) return;
      setIsLoading(true);
      setFailed(false);
      try {
        const [member1, member2] = await Promise.all([
          member1IsUsername
            ? resolveUsername(member1Value)
            : resolveLegacyId(member1Value),
          member2IsUsername
            ? resolveUsername(member2Value)
            : resolveLegacyId(member2Value),
        ]);
        if (!isActive()) return;
        if (!member1 || !member2) {
          setMessages([]);
          setReferenceThreads([]);
          setQueried(true);
          return;
        }

        const result: AdminMessage[] | MessagesResponse = await getMessages(
          member1._id,
          member2._id,
        );
        if (!isActive()) return;
        const nextMessages = Array.isArray(result)
          ? result
          : result.messages || [];
        setMessages(nextMessages);
        setReferenceThreads(
          Array.isArray(result) ? [] : result.referenceThreads || [],
        );
        setQueried(true);

        if (member1.username && member2.username) {
          const canonicalUrl = `/admin/messages?username1=${encodeURIComponent(
            member1.username,
          )}&username2=${encodeURIComponent(member2.username)}`;
          if (
            `${window.location.pathname}${window.location.search}` !==
            canonicalUrl
          ) {
            window.history.replaceState({}, '', canonicalUrl);
          }
        }
      } catch {
        if (!isActive()) return;
        setMessages([]);
        setReferenceThreads([]);
        setFailed(true);
        setQueried(true);
      } finally {
        if (isActive()) setIsLoading(false);
      }
    },
    [member1IsUsername, member1Value, member2IsUsername, member2Value],
  );

  useEffect(() => {
    let active = true;
    void runQuery(() => active);
    return () => {
      active = false;
    };
  }, [runQuery]);

  return (
    <>
      <AdminHeader />
      <div className="container">
        <h2>Messages</h2>

        {!member1Value || !member2Value ? (
          <p className="text-muted">
            Open a conversation from a member or reference page.
          </p>
        ) : isLoading ? (
          <p className="text-muted" role="status">
            Loading conversation…
          </p>
        ) : null}

        {failed && (
          <Alert tone="danger" role="alert">
            Unable to load conversation.
          </Alert>
        )}

        {queried && !failed && messages.length > 0 && (
          <>
            <h3>
              Messaging between <UserLink user={messages[0].userFrom} />
              {' & '}
              <UserLink user={messages[0].userTo} />
            </h3>
            <p className="text-muted">Times in UTC.</p>
            {referenceThreads.length > 0 && (
              <Alert tone="warning" role="note">
                <strong>Thread votes</strong>
                <ul>
                  {referenceThreads.map(referenceThread => (
                    <AdminReferenceVoteItem
                      key={referenceThread._id}
                      referenceThread={referenceThread}
                    />
                  ))}
                </ul>
              </Alert>
            )}
            {messages.map(message => {
              const sender = message.userFrom || { _id: '' };
              const sentByFirstMember =
                sender._id === messages[0].userFrom?._id;
              const senderName = sender.username
                ? sender.displayName || sender.username
                : sender.displayName || 'Unknown member';
              return (
                <MessageBubble
                  className={
                    sentByFirstMember
                      ? 'message-sender-me'
                      : 'message-sender-other'
                  }
                  key={message._id}
                >
                  <div className="message-main">
                    <div className="message-meta">
                      {sender.username ? (
                        <a href={`/profile/${sender.username}`}>{senderName}</a>
                      ) : (
                        <span>{senderName}</span>
                      )}
                      <span aria-hidden="true">·</span>
                      <MessageTimestamp value={message.created} />
                      <span aria-hidden="true">·</span>
                      <span>{message.read ? 'Seen' : 'Not seen'}</span>
                    </div>
                    <div className="panel panel-default">
                      <RichText
                        className="panel-body"
                        content={message.content}
                      />
                    </div>
                  </div>
                  <div className="message-author">
                    <Avatar
                      user={sender}
                      size={32}
                      link={Boolean(sender.username)}
                    />
                  </div>
                </MessageBubble>
              );
            })}
          </>
        )}
        {queried && !failed && messages.length === 0 && (
          <Alert tone="info" role="status">
            <em>Nothing found…</em>
          </Alert>
        )}
      </div>
    </>
  );
}
