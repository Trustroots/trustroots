import { Outlet, useMatches, useRouter } from '@tanstack/react-router';
import React, { useEffect } from 'react';

import AppHeader from '@/layers/shell/client/components/AppHeader.component';
import { getReactRoutePolicy } from '@/modules/core/shared/react-route-ownership.mts';
import { useAuth } from '@/modules/core/client/react-app/auth';
import { useSettings } from '@/modules/core/client/react-app/app-context';
import ReactFooter from './ReactFooter';
import type { RoutePolicy } from './route-options';
import { getClientNavigationTarget } from './shell-helpers';

export default function ReactAppShell() {
  const { build } = useSettings();
  const { user } = useAuth();
  const router = useRouter();
  const match = useMatches({ select: matches => matches[matches.length - 1] });
  const route = match?.staticData as RoutePolicy | undefined;

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = getClientNavigationTarget(event);
      const targetRoute = target && getReactRoutePolicy(target);

      if (!targetRoute) {
        return;
      }

      event.preventDefault();
      void router.navigate({
        href: target,
        resetScroll: !targetRoute.noScrollingTop,
      });
    };

    document.addEventListener('click', handleDocumentClick);

    return () => document.removeEventListener('click', handleDocumentClick);
  }, [router]);

  return (
    <>
      <div id="tr-wrap">
        {!route?.headerHidden && (
          <AppHeader currentPath={match?.pathname} user={user} />
        )}
        <article className="content" id="tr-main" role="main" tabIndex={-1}>
          <Outlet />
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
