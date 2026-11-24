import React from 'react';
import { useTranslation } from 'react-i18next';
import { CHAT_ATTRIBUTION_TAG } from '../../shared/circle-chat';
import type { Event } from 'nostr-tools';
import CircleNostrIdentity from './CircleNostrIdentity';

export default function CircleChatLog({
  messages,
  usernames,
  stationLink,
  servicePubkey,
}: {
  messages: Event[];
  usernames: Record<string, string>;
  servicePubkey?: string;
  stationLink?: (event: Event) => React.ReactNode;
}) {
  const { t } = useTranslation('circles');
  return (
    <ol className="radio-chat-log" aria-live="polite">
      {messages.map(event => {
        const timestamp = new Date(event.created_at * 1000).toISOString();
        const attribution =
          event.pubkey === servicePubkey
            ? event.tags.find(([name]) => name === CHAT_ATTRIBUTION_TAG)?.[1]
            : undefined;
        return (
          <li key={event.id}>
            <strong>
              {attribution ? (
                t('{{username}} via Trustroots', { username: attribution })
              ) : (
                <CircleNostrIdentity
                  pubkey={event.pubkey}
                  username={usernames[event.pubkey]}
                />
              )}
            </strong>{' '}
            <time dateTime={timestamp}>
              {timestamp.slice(0, 16).replace('T', ' ')}
            </time>{' '}
            UTC{stationLink?.(event)}
            <p>{event.content}</p>
          </li>
        );
      })}
    </ol>
  );
}
