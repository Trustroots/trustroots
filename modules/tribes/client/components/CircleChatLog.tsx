import React from 'react';
import type { Event } from 'nostr-tools';
import CircleNostrIdentity from './CircleNostrIdentity';

export default function CircleChatLog({
  messages,
  usernames,
  stationLink,
}: {
  messages: Event[];
  usernames: Record<string, string>;
  stationLink?: (event: Event) => React.ReactNode;
}) {
  return (
    <ol className="radio-chat-log" aria-live="polite">
      {messages.map(event => {
        const timestamp = new Date(event.created_at * 1000).toISOString();
        return (
          <li key={event.id}>
            <strong>
              <CircleNostrIdentity
                pubkey={event.pubkey}
                username={usernames[event.pubkey]}
              />
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
