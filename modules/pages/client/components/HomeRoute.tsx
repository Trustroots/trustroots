import React, { useLayoutEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Home from './Home.component';
import {
  useAppConfig,
  useSettings,
} from '@/modules/core/client/react-app/AppProviders';
import { onClientEvent } from '@/modules/core/client/services/client-runtime';
import type { PageUser } from '../types';

type PhotoCredits = Record<string, string>;

export default function HomeRoute({ user }: { user?: PageUser | null }) {
  const { isNativeMobileApp } = useAppConfig();
  const { build } = useSettings();
  const [photoCredits, setPhotoCredits] = useState<PhotoCredits>({});
  const listenForPhotoCredits = onClientEvent as unknown as (
    eventName: 'photoCreditsRemoved' | 'photoCreditsUpdated',
    listener: (event: null, photos: PhotoCredits) => void,
  ) => () => void;
  useLayoutEffect(() => {
    const stopAdding = listenForPhotoCredits(
      'photoCreditsUpdated',
      (_event, photos) => {
        setPhotoCredits(current => ({ ...current, ...photos }));
      },
    );
    const stopRemoving = listenForPhotoCredits(
      'photoCreditsRemoved',
      (_event, photos) => {
        setPhotoCredits(current =>
          Object.fromEntries(
            Object.entries(current).filter(
              ([name]) => !Object.prototype.hasOwnProperty.call(photos, name),
            ),
          ),
        );
      },
    );
    return () => {
      stopAdding();
      stopRemoving();
    };
  }, []);
  const routeParams: Record<string, string> = {};
  new URLSearchParams(window.location.search).forEach((value, key) => {
    routeParams[key] = value;
  });
  return (
    <Home
      user={user}
      build={build}
      isNativeMobileApp={isNativeMobileApp}
      photoCredits={photoCredits}
      routeParams={routeParams}
    />
  );
}

HomeRoute.propTypes = { user: PropTypes.object };
