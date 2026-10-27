import { useEffect, useRef, useState } from 'react';
import httpClient from '../api/http-client';
import { getCurrentUser } from '../services/client-runtime';

export interface MapDefaultLocation {
  latitude: number;
  longitude: number;
  zoom: number;
}

type CurrentUser = NonNullable<ReturnType<typeof getCurrentUser>>;
const pending = new WeakMap<CurrentUser, Promise<MapDefaultLocation | null>>();

function requestLocation(account: CurrentUser) {
  let request = pending.get(account);
  if (!request) {
    request = httpClient
      .get<{ location: MapDefaultLocation | null }>(
        '/api/map-default-location',
        { timeout: 5000 },
      )
      .then(({ data }) => {
        const value = data.location;
        return value &&
          Number.isFinite(value.latitude) &&
          Math.abs(value.latitude) <= 85 &&
          Number.isFinite(value.longitude) &&
          Math.abs(value.longitude) <= 180 &&
          Number.isFinite(value.zoom) &&
          value.zoom >= 0 &&
          value.zoom <= 6
          ? value
          : null;
      })
      .catch(() => null)
      .finally(() => {
        pending.delete(account);
      });
    pending.set(account, request);
  }
  return request;
}

/** A late approximate location must never undo the member's camera choice. */
export default function useMapDefaultLocation(enabled: boolean) {
  const account = getCurrentUser();
  const scope = useRef({ account, stopped: false });
  if (scope.current.account !== account)
    scope.current = { account, stopped: false };
  const [result, setResult] = useState<{
    scope: typeof scope.current;
    location: MapDefaultLocation | null;
  } | null>(null);

  useEffect(() => {
    const current = scope.current;
    let active = true;
    if (enabled && account && !current.stopped) {
      void requestLocation(account).then(location => {
        if (active && !current.stopped && getCurrentUser() === account) {
          setResult({ scope: current, location });
        }
      });
    }
    return () => {
      active = false;
    };
  }, [account, enabled]);

  return [
    result?.scope === scope.current ? result.location : null,
    () => {
      scope.current.stopped = true;
    },
  ] as const;
}
