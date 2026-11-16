import React from 'react';
import moment from 'moment';
import { useTranslation } from 'react-i18next';

import InfiniteMessages from '@/modules/messages/client/components/InfiniteMessages';
import Avatar from '@/modules/users/client/components/Avatar.component';
import ThreadMessage from '@/modules/messages/client/components/ThreadMessage';
import type { Message, MessageUser } from '../api/messages.api';
import { Alert } from '@trustroots/ui/Alert';

function MessagesContainer(
  props: Pick<React.ComponentProps<'div'>, 'children' | 'onScroll' | 'ref'>,
) {
  return (
    <div
      {...props}
      className="thread-messages tw:min-h-0 tw:flex-[1_1_auto] tw:overflow-y-auto tw:pt-[30px] tw:pe-[30px] tw:sm:pe-0"
    />
  );
}

type ThreadMessagesProps = {
  isExtraSmall: boolean;
  user: MessageUser;
  otherUser: MessageUser;
  messages: Message[];
  onFetchMore: () => void;
  profileMinimumLength?: number;
};

export default function ThreadMessages({
  isExtraSmall,
  user,
  otherUser,
  messages,
  onFetchMore,
}: ThreadMessagesProps) {
  const { t } = useTranslation('messages');
  return (
    <InfiniteMessages component={MessagesContainer} onFetchMore={onFetchMore}>
      <Alert intent="warning" role="note">
        <strong>{t('Safety note:')}</strong>{' '}
        {t(
          'Trustroots will never ask you for your ID, credit card details, or payment of any kind.',
        )}
      </Alert>
      {isExtraSmall && otherUser.username && (
        <div className="message">
          <div className="message-recipient panel panel-default">
            <a className="panel-body" href={`/profile/${otherUser.username}`}>
              <Avatar user={otherUser} size={32} link={false} />
              <h4>{otherUser.displayName}</h4>
              <small className="text-muted">@{otherUser.username}</small>
            </a>
          </div>
        </div>
      )}
      <div className="message">
        <div className="divider divider-first text-muted">
          <small>
            {t('Conversation started {{ date }}', {
              date: moment(messages[0].created).format('LL'),
            })}
          </small>
        </div>
      </div>
      {messages.map(message => (
        <ThreadMessage key={message._id} message={message} user={user} />
      ))}
    </InfiniteMessages>
  );
}
