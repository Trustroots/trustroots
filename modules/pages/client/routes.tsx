import React from 'react';

import {
  renderWithUser,
  type RouteContext,
  type RouteRender,
} from '@/modules/core/client/react-app/route-render';
import HomeRoute from '@/modules/pages/client/components/HomeRoute';
import Navigation from '@/modules/pages/client/components/Navigation.component';
import Contribute from '@/modules/pages/client/components/Contribute.component';
import Credits from '@/modules/pages/client/components/Credits.component';
import FaqBugsAndFeatures from '@/modules/pages/client/components/FaqBugsAndFeatures.component';
import FaqFoundation from '@/modules/pages/client/components/FaqFoundation.component';
import FaqGeneral from '@/modules/pages/client/components/FaqGeneral.component';
import FaqTechnology from '@/modules/pages/client/components/FaqTechnology.component';
import FaqTribes from '@/modules/pages/client/components/FaqTribes.component';
import Foundation from '@/modules/pages/client/components/Foundation.component';
import Guide from '@/modules/pages/client/components/Guide.component';
import Media from '@/modules/pages/client/components/Media.component';
import Privacy from '@/modules/pages/client/components/Privacy.component';
import Rules from '@/modules/pages/client/components/Rules.component';
import Safety from '@/modules/pages/client/components/Safety.component';
import Team from '@/modules/pages/client/components/Team.component';
import Greeters from '@/modules/pages/client/components/Greeters.component';
import Volunteering from '@/modules/pages/client/components/Volunteering.component';

function NavigationRoute({ user }: RouteContext) {
  return (
    <Navigation
      user={user as React.ComponentProps<typeof Navigation>['user']}
    />
  );
}

export const pagesRoutes: Record<string, RouteRender> = {
  '/': renderWithUser(HomeRoute),
  '/about': renderWithUser(HomeRoute),
  '/contribute': () => <Contribute />,
  '/faq': () => <FaqGeneral />,
  '/faq/bugs-and-features': () => <FaqBugsAndFeatures />,
  '/faq/circles': () => <FaqTribes />,
  '/faq/foundation': () => <FaqFoundation />,
  '/faq/technology': () => <FaqTechnology />,
  '/foundation': renderWithUser(Foundation),
  '/credits': () => <Credits />,
  '/guide': () => <Guide />,
  '/media': () => <Media />,
  '/navigation': renderWithUser(NavigationRoute),
  '/privacy': () => <Privacy />,
  '/rules': () => <Rules />,
  '/safety': () => <Safety />,
  '/team': renderWithUser(Team),
  '/team/greeters': renderWithUser(Greeters),
  '/volunteering': () => <Volunteering />,
};
