import {
  Outlet,
  useRouteContext,
  useRouter,
  useRouterState,
} from '@tanstack/react-router';
import React, { useEffect } from 'react';

import AppHeader from '@/layers/shell/client/components/AppHeader.component';
import NotFoundPage from '@/modules/core/client/components/NotFoundPage.component';
import {
  getReactRoutePolicy,
  isReactOwnedPath,
} from '@/modules/core/shared/react-route-ownership.mts';
import { useAuth } from '@/modules/core/client/react-app/auth';
import {
  useAppConfig,
  useSettings,
} from '@/modules/core/client/react-app/app-context';
import ReactFooter from './ReactFooter';
import { getClientNavigationTarget } from './shell-helpers';

export default function ReactAppShell() {
  const { title } = useAppConfig();
  const { build } = useSettings();
  const { navigateOverride } = useRouteContext({ from: '__root__' });
  const { user } = useAuth();
  const locationHref = useRouterState({
    select: state => state.location.href,
  });
  const locationHash = useRouterState({
    select: state => state.location.hash,
  });
  const router = useRouter();
  const location = new URL(locationHref, window.location.origin);
  const currentPath = `${location.pathname}${location.search}`;
  const route = getReactRoutePolicy(currentPath);
  const navigate = (target: string) => {
    if (navigateOverride) {
      navigateOverride(target);
      return;
    }

    void router.navigate({ href: target });
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
    const rawHash = locationHash || location.hash;
    if (!rawHash) {
      return undefined;
    }

    const targetId = decodeURIComponent(
      rawHash.startsWith('#') ? rawHash.slice(1) : rawHash,
    );
    if (!targetId) {
      return undefined;
    }

    // Wait until the app shell has finished resetting the page scroll position.
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [locationHash, locationHref, route]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
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
        {!route?.headerHidden && (
          <AppHeader currentPath={location.pathname} user={user} />
        )}
        <article className="content" id="tr-main" role="main" tabIndex={-1}>
          {route?.path === '/not-found' ? <NotFoundPage /> : <Outlet />}
        </article>
      </div>
      {!route?.footerHidden && (
        <ReactFooter
          build={build as React.ComponentProps<typeof ReactFooter>['build']}
          variant={route?.footerVariant || (!route ? 'account' : 'standard')}
        />
      )}
    </>
  );
}
