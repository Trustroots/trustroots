import { useCallback, useEffect, useRef, useState } from 'react';
import httpClient from '../api/http-client';
import { useAuth } from '../react-app/auth';

export interface MapDefaultLocation {
  latitude: number;
  longitude: number;
  zoom: number;
}

const pending = new Map<string, Promise<MapDefaultLocation | null>>();

function requestLocation(account: string) {
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

/** Fetches an authenticated approximate location, sharing in-flight requests. */
export function useRequestMapDefaultLocation() {
  const account = useAuth().user?._id ?? null;
  const currentAccount = useRef(account);
  currentAccount.current = account;

  return useCallback(async (): Promise<MapDefaultLocation | null> => {
    const account = currentAccount.current;
    if (!account) return null;

    const location = await requestLocation(account);
    return currentAccount.current === account ? location : null;
  }, []);
}

/** A late approximate location must never undo the member's camera choice. */
export default function useMapDefaultLocation(enabled: boolean) {
  const account = useAuth().user?._id ?? null;
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
        if (active && !current.stopped) {
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
