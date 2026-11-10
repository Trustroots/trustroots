import React, { useEffect, useState } from 'react';
import { npubEncode } from 'nostr-tools/nip19';
import type { Event } from 'nostr-tools';
import { fetchRadioAuthorUsernames } from '../services/radio.client.service';

export default function CircleChatLog({
  messages,
  stationLink,
}: {
  messages: Event[];
  stationLink?: (event: Event) => React.ReactNode;
}) {
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const authorKeys = [...new Set(messages.map(event => event.pubkey))]
    .sort()
    .join(',');

  useEffect(() => {
    if (!authorKeys) return;
    const controller = new AbortController();
    void fetchRadioAuthorUsernames(authorKeys.split(','), controller.signal)
      .then(profiles => {
        if (!controller.signal.aborted) setUsernames(profiles);
      })
      .catch(() => {
        if (!controller.signal.aborted) setUsernames({});
      });
    return () => controller.abort();
  }, [authorKeys]);

  return (
    <ol className="radio-chat-log" aria-live="polite">
      {messages.map(event => {
        const npub = npubEncode(event.pubkey);
        const username = usernames[event.pubkey];
        const timestamp = new Date(event.created_at * 1000).toISOString();
        return (
          <li key={event.id}>
            <strong>
              {username ? (
                <a href={`/profile/${encodeURIComponent(username)}`}>{npub}</a>
              ) : (
                npub
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
