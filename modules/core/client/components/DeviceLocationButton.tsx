import React from 'react';
import { useTranslation } from 'react-i18next';

import useDeviceLocation, {
  type DeviceLocation,
  type DeviceLocationError,
} from '../utils/use-device-location';

type DeviceLocationButtonProps = {
  onLocation: (location: DeviceLocation) => void;
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
  onRequest,
}: DeviceLocationButtonProps) {
  const { t } = useTranslation('core');
  const { status, error, requestLocation } = useDeviceLocation(onLocation);
  const isPending = status === 'pending';
  const statusMessage = isPending
    ? t('Finding your location…')
    : error
      ? t(errorMessages[error])
      : '';

  return (
    <>
      <button
        type="button"
        className="btn btn-default device-location-button"
        disabled={isPending}
        aria-busy={isPending}
        onClick={() => {
          onRequest?.();
          requestLocation();
        }}
      >
        {isPending ? t('Finding your location…') : t('Use my location')}
      </button>
      <span role="status" aria-live="polite">
        {statusMessage}
      </span>
    </>
  );
}
