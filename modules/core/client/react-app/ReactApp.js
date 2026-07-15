import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';

import AppHeader from '@/modules/core/client/components/AppHeader.component';
import NotFoundPage from '@/modules/core/client/components/NotFoundPage.component';
import { getReactRouteAccessRedirect } from '@/modules/core/shared/react-route-ownership';
import { useAuth } from './auth';
import ReactFooter from './ReactFooter';
import { findRoute } from './routes';
import { useAppConfig, useSettings } from './AppProviders';

function signout(event) {
  if (event) {
    event.preventDefault();
  }

  if (window.postMessage) {
    window.postMessage(
      'unAuthenticated',
      `${window.location.protocol}//${window.location.host}`,
    );
  }

  if (window.isNativeMobileApp && window.postMessage) {
    window.postMessage(JSON.stringify({ action: 'unAuthenticated' }));
  }

  window.top.location.href = '/api/auth/signout';
}

function defaultNavigate(url) {
  window.location.assign(url);
}

export default function ReactApp({ navigate = defaultNavigate }) {
  const { title } = useAppConfig();
  const { build } = useSettings();
  const { user } = useAuth();
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const route = findRoute(currentPath);
  const accessRedirect = getReactRouteAccessRedirect(route, user);

  useEffect(() => {
    const onPopState = () => setCurrentPath(window.location.pathname);

    window.addEventListener('popstate', onPopState);

    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (route?.title) {
      document.title = `${route.title} - Trustroots`;
    } else {
      document.title = title;
    }

    if (!route?.noScrollingTop) {
      window.scrollTo(0, 0);
    }
  }, [route, title]);

  useEffect(() => {
    if (accessRedirect) {
      navigate(accessRedirect);
    }
  }, [accessRedirect, navigate]);

  return (
    <>
      <div id="tr-wrap">
        {!route?.headerHidden && <AppHeader onSignout={signout} user={user} />}
        <article className="content" id="tr-main" role="main" tabIndex="-1">
          {route && !accessRedirect ? route.render({ user }) : <NotFoundPage />}
        </article>
      </div>
      {!route?.footerHidden && (
        <ReactFooter
          build={build}
          variant={route?.footerVariant || 'standard'}
        />
      )}
    </>
  );
}

ReactApp.propTypes = {
  navigate: PropTypes.func,
};
