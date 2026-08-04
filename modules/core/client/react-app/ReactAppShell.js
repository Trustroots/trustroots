import {
  Outlet,
  useRouteContext,
  useRouter,
  useRouterState,
} from '@tanstack/react-router';
import React, { useEffect } from 'react';

import AppHeader from '@/modules/core/client/components/AppHeader.component';
import NotFoundPage from '@/modules/core/client/components/NotFoundPage.component';
import {
  getReactRouteAccessRedirect,
  getReactRoutePolicy,
  isReactOwnedPath,
} from '@/modules/core/shared/react-route-ownership';
import { useAppConfig, useSettings } from './AppProviders';
import ReactFooter from './ReactFooter';
import { getClientNavigationTarget, signout } from './shell-helpers';

export default function ReactAppShell() {
  const { title } = useAppConfig();
  const { build } = useSettings();
  const { navigateOverride, user } = useRouteContext({ from: '__root__' });
  const locationHref = useRouterState({
    select: state => state.location.href,
  });
  const router = useRouter();
  const location = new URL(locationHref, window.location.origin);
  const currentPath = `${location.pathname}${location.search}`;
  const route = getReactRoutePolicy(currentPath);
  const accessRedirect = getReactRouteAccessRedirect(route, user, currentPath);
  const redirect =
    route?.redirectTo || accessRedirect || (!route && '/not-found');
  const navigate = target => {
    if (navigateOverride) {
      navigateOverride(target);
      return;
    }

    const destination = new URL(target, window.location.origin);
    router.navigate({
      hash: destination.hash.slice(1),
      search: Object.fromEntries(destination.searchParams),
      to: destination.pathname,
    });
  };

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
    if (redirect) {
      navigate(redirect);
    }
  }, [redirect]);

  useEffect(() => {
    const handleDocumentClick = event => {
      const target = getClientNavigationTarget(event);

      if (!target || !isReactOwnedPath(target)) {
        return;
      }

      event.preventDefault();
      navigate(target);
    };

    document.addEventListener('click', handleDocumentClick);

    return () => document.removeEventListener('click', handleDocumentClick);
  }, [navigateOverride, router]);

  return (
    <>
      <div id="tr-wrap">
        {!route?.headerHidden && <AppHeader onSignout={signout} user={user} />}
        <article className="content" id="tr-main" role="main" tabIndex="-1">
          {redirect ? <NotFoundPage /> : <Outlet />}
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
