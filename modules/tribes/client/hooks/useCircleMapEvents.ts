import { useEffect, useMemo, useState } from 'react';
import type { Event, Filter } from 'nostr-tools';
import type NostrService from '@/modules/search/client/services/nostr.client.service';

export function currentPlaceEvents(events: Event[]): Event[] {
  const latest = new Map<string, Event>();
  for (const event of events) {
    if (event.kind === 5) continue;
    const d = event.tags.find(tag => tag[0] === 'd')?.[1];
    const address = `${event.kind}:${event.pubkey}:${d || event.id}`;
    const previous = latest.get(address);
    if (
      !previous ||
      event.created_at > previous.created_at ||
      (event.created_at === previous.created_at && event.id < previous.id)
    )
      latest.set(address, event);
  }
  return [...latest.entries()]
    .filter(
      ([address, event]) =>
        !events.some(
          deletion =>
            deletion.kind === 5 &&
            deletion.pubkey === event.pubkey &&
            deletion.created_at >= event.created_at &&
            deletion.tags.some(
              tag =>
                (tag[0] === 'a' && tag[1] === address) ||
                (tag[0] === 'e' && tag[1] === event.id),
            ),
        ),
    )
    .map(([, event]) => event);
}

// Filters are source constants: changing source releases the old subscription.
export function useCircleMapEvents(
  service: NostrService,
  filters: Filter[],
  disconnectOnUnmount = false,
) {
  const [events, setEvents] = useState<Event[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let active = true;
    let subscription: { close: () => void } | undefined;
    setEvents([]);
    setState('loading');
    service
      .connect()
      .then(relay => {
        if (!active) {
          if (disconnectOnUnmount) service.disconnect();
          return;
        }
        subscription = relay.subscribe(filters, {
          onevent(event) {
            if (active)
              setEvents(current => [
                ...current.filter(value => value.id !== event.id),
                event,
              ]);
          },
          oneose() {
            if (active) setState('ready');
          },
          onclose() {
            if (active) setState('error');
          },
        });
      })
      .catch(() => {
        if (active) setState('error');
      });
    return () => {
      active = false;
      subscription?.close();
      if (disconnectOnUnmount) service.disconnect();
    };
  }, [service, filters, disconnectOnUnmount]);
  const current = useMemo(() => currentPlaceEvents(events), [events]);
  return { events: current, state };
}
