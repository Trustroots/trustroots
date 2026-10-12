import React, { useEffect, useMemo, useState } from 'react';
import NostrService from '@/modules/search/client/services/nostr.client.service';
import CircleLocationMap, { type CircleLocation } from './CircleLocationMap';
import { useCircleMapEvents } from '../hooks/useCircleMapEvents';
import {
  HITCHWIKI_AUTHOR,
  HITCHHIKING_KIND,
  SEVEN_DAYS_SECONDS,
  HITCHWIKI_RELAY,
  parseHitchhikingLocation,
} from '../services/hitchhiking.client.service';

export default function HitchhikingMap() {
  const [service] = useState(() => new NostrService(HITCHWIKI_RELAY));
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [filters] = useState(() => [
    {
      kinds: [HITCHHIKING_KIND],
      authors: [HITCHWIKI_AUTHOR],
      since: now - SEVEN_DAYS_SECONDS,
    },
    {
      kinds: [5],
      authors: [HITCHWIKI_AUTHOR],
      '#k': [String(HITCHHIKING_KIND)],
    },
  ]);
  const { events, state } = useCircleMapEvents(service, filters, true);
  useEffect(() => {
    const interval = setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      60_000,
    );
    return () => clearInterval(interval);
  }, []);
  const locations = useMemo(
    () =>
      events
        .map(event => parseHitchhikingLocation(event, now))
        .filter((location): location is CircleLocation => !!location),
    [events, now],
  );
  return (
    <CircleLocationMap
      title="Hitchhiking in the past 7 days"
      description="Hitchwiki-reported ride origins. Uses the recorded ride date, or submission date when unknown. Locations have not been independently verified."
      mapLabel="Map of recent Hitchwiki hitchhiking locations"
      locations={locations}
      state={state}
      loadingText="Loading recent locations from Hitchwiki relay…"
      emptyText="No reported locations in the past 7 days."
      errorText="Recent locations could not be loaded from Hitchwiki relay."
      countLabel="recent ride origins"
      attribution={
        <>
          Data:{' '}
          <a
            href="https://maps.hitchwiki.org/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Hitchwiki Maps
          </a>{' '}
          ·{' '}
          <a
            href="https://opendatacommons.org/licenses/odbl/1-0/"
            target="_blank"
            rel="noopener noreferrer"
          >
            ODbL
          </a>
        </>
      }
    />
  );
}
