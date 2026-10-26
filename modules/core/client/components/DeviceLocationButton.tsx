import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import MapDefaultAttribution from './Map/MapDefaultAttribution';
import './device-location-button.less';
import useDeviceLocation, {
  type DeviceLocation,
  type DeviceLocationError,
} from '../utils/use-device-location';
import type { MapDefaultLocation } from '../utils/use-map-default-location';

type DeviceLocationButtonProps = {
  onLocation: (location: DeviceLocation) => void;
  onApproximateLocation?: (location: MapDefaultLocation) => void;
  onRequest?: () => void;
};

const errorMessages: Record<DeviceLocationError, string> = {
  denied:
    'Location access was denied. Enable location permissions in your browser settings, or choose a location manually.',
  unavailable:
    'Your location is unavailable. Try again, or choose a location manually.',
  timeout:
    'The location request timed out. Try again, or choose a location manually.',
  unsupported:
    'Location is not supported by this browser. Choose a location manually.',
};

export default function DeviceLocationButton({
  onLocation,
  onApproximateLocation,
  onRequest,
}: DeviceLocationButtonProps) {
  const { t } = useTranslation('core');
  const { status, error, isApproximate, requestLocation } = useDeviceLocation(
    onLocation,
    onApproximateLocation,
  );
  const [requestId, setRequestId] = useState(0);
  const [dismissedRequestId, setDismissedRequestId] = useState(-1);
  useEffect(() => {
    if (!error) return;
    const timeout = window.setTimeout(
      () => setDismissedRequestId(requestId),
      8000,
    );
    return () => window.clearTimeout(timeout);
  }, [error, requestId]);
  const isPending = status === 'pending';
  const statusMessage = isPending
    ? t('Finding your location…')
    : isApproximate
      ? t('Showing your approximate location.')
      : error
        ? t(errorMessages[error])
        : '';
  const buttonLabel = isPending
    ? t('Finding your location…')
    : t('Use my location');

  return (
    <div className="device-location-control">
      <button
        type="button"
        className="btn btn-default device-location-button"
        disabled={isPending}
        aria-busy={isPending}
        aria-label={buttonLabel}
        title={buttonLabel}
        onClick={() => {
          setRequestId(current => current + 1);
          onRequest?.();
          requestLocation();
        }}
      >
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="6" />
          <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
        </svg>
      </button>
      <span
        role="status"
        aria-live="polite"
        className={
          error && dismissedRequestId === requestId
            ? 'device-location-feedback-dismissed'
            : undefined
        }
      >
        {statusMessage}
        {isApproximate && (
          <>
            {' '}
            <MapDefaultAttribution />
          </>
        )}
      </span>
    </div>
  );
}
