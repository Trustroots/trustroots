import React, { useEffect, useState } from 'react';

import AppHeader from '@/modules/core/client/components/AppHeader.component';
import NotFoundPage from '@/modules/core/client/components/NotFoundPage.component';
import ReactFooter from './ReactFooter';
import { findRoute } from './routes';
import { useAuth, useAppConfig } from './AppProviders';

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

export default function ReactApp() {
  const { title } = useAppConfig();
  const { user } = useAuth();
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const route = findRoute(currentPath);

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

    window.scrollTo(0, 0);
  }, [route, title]);

  return (
    <>
      <div id="tr-wrap">
        <AppHeader onSignout={signout} user={user} />
        <article className="content" id="tr-main" role="main" tabIndex="-1">
          {route ? route.render({ user }) : <NotFoundPage />}
        </article>
      </div>
      <ReactFooter />
    </>
  );
}

ReactApp.propTypes = {};
