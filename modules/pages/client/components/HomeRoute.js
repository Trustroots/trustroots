import React, { useLayoutEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Home from './Home.component';
import {
  useAppConfig,
  useSettings,
} from '@/modules/core/client/react-app/AppProviders';
import { onClientEvent } from '@/modules/core/client/services/client-runtime';

export default function HomeRoute({ user }) {
  const { isNativeMobileApp } = useAppConfig();
  const { build } = useSettings();
  const [photoCredits, setPhotoCredits] = useState({});
  useLayoutEffect(() => {
    const stopAdding = onClientEvent(
      'photoCreditsUpdated',
      (_event, photos) => {
        setPhotoCredits(current => ({ ...current, ...photos }));
      },
    );
    const stopRemoving = onClientEvent(
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
  const routeParams = Object.fromEntries(
    new URLSearchParams(window.location.search),
  );
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
