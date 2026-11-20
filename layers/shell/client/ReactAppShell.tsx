import {
  Outlet,
  useLocation,
  useMatches,
  useRouter,
} from '@tanstack/react-router';
import React, { useEffect } from 'react';

import AppHeader from '@/layers/shell/client/components/AppHeader.component';
import NotFoundPage from '@/modules/core/client/components/NotFoundPage.component';
import {
  getReactRoutePolicy,
  isReactOwnedPath,
} from '@/modules/core/shared/react-route-ownership.mts';
import { useAuth } from '@/modules/core/client/react-app/auth';
import { useSettings } from '@/modules/core/client/react-app/app-context';
import ReactFooter from './ReactFooter';
import type { RoutePolicy } from './route-options';
import { getClientNavigationTarget } from './shell-helpers';

export default function ReactAppShell() {
  const { build } = useSettings();
  const { user } = useAuth();
  const router = useRouter();
  const currentPath = useLocation({ select: location => location.pathname });
  const match = useMatches({ select: matches => matches[matches.length - 1] });
  const route = match?.staticData as RoutePolicy | undefined;
  const policyPath = getReactRoutePolicy(currentPath)?.path;
  const redirectToNotFound =
    currentPath !== '/not-found' &&
    (!policyPath || policyPath === '/not-found');

  // The prerendered root guard may be skipped on the initial document load.
  useEffect(() => {
    if (redirectToNotFound) {
      void router.navigate({ to: '/not-found', replace: true });
    }
  }, [redirectToNotFound, router]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = getClientNavigationTarget(event);
      if (!target || !isReactOwnedPath(target)) {
        return;
      }

      event.preventDefault();
      void router.navigate({ href: target });
    };

    document.addEventListener('click', handleDocumentClick);

    return () => document.removeEventListener('click', handleDocumentClick);
  }, [router]);

  return (
    <>
      <div id="tr-wrap">
        {!route?.headerHidden && (
          <AppHeader currentPath={currentPath} user={user} />
        )}
        <article className="content" id="tr-main" role="main" tabIndex={-1}>
          {redirectToNotFound ? <NotFoundPage /> : <Outlet />}
        </article>
      </div>
      {!route?.footerHidden && (
        <ReactFooter
          build={build as React.ComponentProps<typeof ReactFooter>['build']}
          variant={route?.footerVariant}
        />
      )}
    </>
  );
}
