import { useEffect, useRef, useState } from 'react';

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
) {
  const [status, setStatus] = useState<DeviceLocationStatus>('idle');
  const [error, setError] = useState<DeviceLocationError | null>(null);
  const mounted = useRef(false);
  const pending = useRef(false);
  const onLocationRef = useRef(onLocation);
  onLocationRef.current = onLocation;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const requestLocation = () => {
    if (pending.current) return;

    const geolocation =
      typeof navigator === 'undefined' ? undefined : navigator.geolocation;
    if (!geolocation) {
      setError('unsupported');
      setStatus('error');
      return;
    }

    pending.current = true;
    setError(null);
    setStatus('pending');

    let completed = false;
    const finish = () => {
      if (completed) return false;
      completed = true;
      pending.current = false;
      return true;
    };

    try {
      geolocation.getCurrentPosition(
        position => {
          if (!finish()) return;
          const location = getCoordinates(position);
          if (!mounted.current) return;
          if (!location) {
            setError('unavailable');
            setStatus('error');
            return;
          }
          setStatus('idle');
          onLocationRef.current(location);
        },
        (positionError: PositionError) => {
          if (!finish()) return;
          if (!mounted.current) return;
          setError(getError(positionError.code));
          setStatus('error');
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 },
      );
    } catch {
      if (!finish()) return;
      if (mounted.current) {
        setError('unavailable');
        setStatus('error');
      }
    }
  };

  return { status, error, requestLocation } as const;
}
