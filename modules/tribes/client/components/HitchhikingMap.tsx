import React, { useEffect, useMemo, useState } from 'react';
import NostrService from '@/modules/search/client/services/nostr.client.service';
import CircleLocationMap, { type CircleLocation } from './CircleLocationMap';
import { useCircleMapEvents } from '../hooks/useCircleMapEvents';
import { useHitchwikiProfiles } from '../hooks/useHitchwikiProfiles';
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
  const profileLocations = useHitchwikiProfiles(locations);
  return (
    <CircleLocationMap
      title="Hitchhikers on the road"
      description="Recent rides shared on Hitchwiki Maps."
      mapLabel="Map of recent Hitchwiki hitchhiking locations"
      locations={profileLocations}
      state={state}
      loadingText="Loading recent locations from Hitchwiki relay…"
      emptyText="No reported locations in the past 7 days."
      errorText="Recent locations could not be loaded from Hitchwiki relay."
      countLabel="ride origins in the past 7 days"
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
