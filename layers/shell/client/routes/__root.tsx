import { createRootRouteWithContext, redirect } from '@tanstack/react-router';

import {
  getReactRouteAccessRedirect,
  getReactRoutePolicy,
  type ReactRoutePolicy,
} from '@/modules/core/shared/react-route-ownership.mts';
import NotFoundPage from '@/modules/core/client/components/NotFoundPage.component';
import type { AuthUser } from '@/modules/core/client/react-app/auth';
import ReactAppShell from '../ReactAppShell';

type AppRouterContext = {
  user: AuthUser | null;
  navigateOverride?: (target: string) => void;
};
type GuardOptions = { context: AppRouterContext; location: { href: string } };

export function guardFromPolicy(policy: ReactRoutePolicy | null) {
  return ({ context, location }: GuardOptions) => {
    const target = policy
      ? policy.redirectTo ||
        getReactRouteAccessRedirect(policy, context.user, location.href)
      : '/not-found';
    if (target) throw redirect({ href: target, replace: true });
  };
}

export const Route = createRootRouteWithContext<AppRouterContext>()({
  beforeLoad: options =>
    guardFromPolicy(getReactRoutePolicy(options.location.pathname))(options),
  component: ReactAppShell,
  notFoundComponent: NotFoundPage,
});
