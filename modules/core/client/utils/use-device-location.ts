import { useEffect, useRef, useState } from 'react';
import {
  useRequestMapDefaultLocation,
  type MapDefaultLocation,
} from './use-map-default-location';

export type DeviceLocation = { lat: number; lng: number };
export type DeviceLocationError =
  'denied' | 'unavailable' | 'timeout' | 'unsupported';
export type DeviceLocationStatus = 'idle' | 'pending' | 'error';

type PositionError = Pick<GeolocationPositionError, 'code'>;

function getError(code: number): DeviceLocationError {
  switch (code) {
    case 1:
      return 'denied';
    case 3:
      return 'timeout';
    default:
      return 'unavailable';
  }
}

function getCoordinates(position: GeolocationPosition): DeviceLocation | null {
  const { latitude: lat, longitude: lng } = position.coords;
  if (
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90 ||
    !Number.isFinite(lng) ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  return { lat, lng };
}

/** Requests the browser's current position only when explicitly asked. */
export default function useDeviceLocation(
  onLocation: (location: DeviceLocation) => void,
  onApproximateLocation?: (location: MapDefaultLocation) => void,
) {
  const requestMapDefaultLocation = useRequestMapDefaultLocation();
  const [status, setStatus] = useState<DeviceLocationStatus>('idle');
  const [error, setError] = useState<DeviceLocationError | null>(null);
  const [isApproximate, setIsApproximate] = useState(false);
  const mounted = useRef(false);
  const pending = useRef(false);
  const onLocationRef = useRef(onLocation);
  const onApproximateLocationRef = useRef(onApproximateLocation);
  onLocationRef.current = onLocation;
  onApproximateLocationRef.current = onApproximateLocation;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const requestLocation = () => {
    if (pending.current) return;

    pending.current = true;
    setError(null);
    setIsApproximate(false);
    setStatus('pending');

    let completed = false;
    const completeDeviceRequest = () => {
      if (completed) return false;
      completed = true;
      return true;
    };

    const reportError = (deviceError: DeviceLocationError) => {
      const approximateHandler = onApproximateLocationRef.current;
      if (!mounted.current) {
        pending.current = false;
        return;
      }

      if (!approximateHandler) {
        pending.current = false;
        setError(deviceError);
        setStatus('error');
        return;
      }

      void requestMapDefaultLocation().then(location => {
        pending.current = false;
        if (!mounted.current) return;
        if (!location) {
          setError(deviceError);
          setStatus('error');
          return;
        }
        setError(null);
        setIsApproximate(true);
        setStatus('idle');
        onApproximateLocationRef.current?.(location);
      });
    };

    try {
      const geolocation =
        typeof navigator === 'undefined' ? undefined : navigator.geolocation;
      if (!geolocation) {
        completeDeviceRequest();
        reportError('unsupported');
        return;
      }

      geolocation.getCurrentPosition(
        position => {
          if (!completeDeviceRequest()) return;
          const location = getCoordinates(position);
          if (!mounted.current) {
            pending.current = false;
            return;
          }
          if (!location) {
            reportError('unavailable');
            return;
          }
          pending.current = false;
          setStatus('idle');
          onLocationRef.current(location);
        },
        (positionError: PositionError) => {
          if (!completeDeviceRequest()) return;
          reportError(getError(positionError.code));
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 },
      );
    } catch {
      if (!completeDeviceRequest()) return;
      reportError('unavailable');
    }
  };

  return { status, error, isApproximate, requestLocation } as const;
}
