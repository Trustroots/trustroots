import React from 'react';
import { useTranslation } from 'react-i18next';

import MessageBubble from './MessageBubble';
import RichText from '@/modules/core/client/components/RichText';

import Avatar from '@/modules/users/client/components/Avatar.component';
import TimeAgo from '@/modules/core/client/components/TimeAgo';
import type { Message, MessageUser } from '../api/messages.api';

function isHosting(content: string): boolean | null {
  if (content.substr(0, 21) === '<p data-hosting="yes"') {
    return true;
  } else if (content.substr(0, 20) === '<p data-hosting="no"') {
    return false;
  } else {
    return null;
  }
}

function getHostingData(content: string): { 'data-hosting'?: 'yes' | 'no' } {
  const hosting = isHosting(content);
  if (hosting === null) return {};
  return {
    'data-hosting': hosting ? 'yes' : 'no',
  };
}

function formatCalendarDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(date);
}

type ThreadMessageProps = { message: Message; user: MessageUser };

export default function ThreadMessage({ message, user }: ThreadMessageProps) {
  const { t } = useTranslation('messages');

  const sender = message.userFrom ?? { _id: '' };
  const sentByMe = sender._id === user._id;

  const deletedUser = !sender.username;

  return (
    <MessageBubble
      {...getHostingData(message.content)}
      className={sentByMe ? 'message-sender-me' : 'message-sender-other'}
    >
      <div className="message-main">
        <div className="message-meta">
          {sentByMe ? (
            <span>{t<string>('You')}</span>
          ) : !deletedUser ? (
            <a href={`/profile/${sender.username}`}>{sender.displayName}</a>
          ) : (
            <span>{t<string>('Unknown member')}</span>
          )}
          <span aria-hidden="true">·</span>
          <TimeAgo date={new Date(message.created)} />
        </div>
        <div className="panel panel-default">
          {message.hostingDetails && (
            <div className="message-hosting-details">
              <strong>{t<string>('Hosting details')}</strong>
              <span>
                {t<string>('Guests: {{count}}', {
                  count: message.hostingDetails.guests,
                })}
              </span>
              {message.hostingDetails.arrival &&
                message.hostingDetails.departure && (
                  <span>
                    {t<string>('{{arrival}} to {{departure}}', {
                      arrival: formatCalendarDate(
                        message.hostingDetails.arrival,
                      ),
                      departure: formatCalendarDate(
                        message.hostingDetails.departure,
                      ),
                    })}
                  </span>
                )}
            </div>
          )}
          <RichText className="panel-body" content={message.content} />
        </div>
      </div>
      <div className="message-author">
        <Avatar user={sender} size={32} link={!deletedUser} />
      </div>
    </MessageBubble>
  );
}
