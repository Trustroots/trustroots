import React from 'react';

import type {
  RouteContext,
  RouteRender,
} from '@/modules/core/client/react-app/route-render';
import OfferShell from '@/modules/offers/client/components/OfferShell.component';
import OfferRedirectPage from '@/modules/offers/client/components/OfferRedirectPage.component';
import OfferHostPage from '@/modules/offers/client/components/OfferHostPage.component';
import OfferMeetListPage from '@/modules/offers/client/components/OfferMeetListPage.component';
import OfferMeetEditPage from '@/modules/offers/client/components/OfferMeetEditPage.component';

function renderOfferPage(Component: React.ElementType) {
  return function renderRoute({ user }: RouteContext) {
    return (
      <OfferShell user={user}>
        <Component user={user} />
      </OfferShell>
    );
  };
}

export const offersRoutes: Record<string, RouteRender> = {
  '/offer': () => <OfferRedirectPage />,
  '/offer/host': renderOfferPage(OfferHostPage),
  '/offer/meet': renderOfferPage(OfferMeetListPage),
  '/offer/meet/add': renderOfferPage(OfferMeetEditPage),
  '/offer/meet/:offerId': renderOfferPage(OfferMeetEditPage),
};
