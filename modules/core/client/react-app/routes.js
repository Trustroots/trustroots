import React from 'react';

import {
  REACT_OWNED_PATHS,
  normalizePath,
} from '@/modules/core/shared/react-route-ownership';
import Contribute from '@/modules/pages/client/components/Contribute.component';
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
import Statistics from '@/modules/statistics/client/components/Statistics.component';
import SupportPage from '@/modules/support/client/components/SupportPage.component';
import Team from '@/modules/pages/client/components/Team.component';
import Volunteering from '@/modules/pages/client/components/Volunteering.component';

export const routes = [
  {
    path: '/contact',
    title: 'Contact us',
    render: ({ user }) => <SupportPage user={user} />,
  },
  {
    path: '/contribute',
    title: 'Contribute',
    render: () => <Contribute />,
  },
  {
    path: '/faq',
    title: 'FAQ - Site & community',
    render: () => <FaqGeneral />,
  },
  {
    path: '/faq/bugs-and-features',
    title: 'FAQ - Bugs & Features',
    render: () => <FaqBugsAndFeatures />,
  },
  {
    path: '/faq/circles',
    title: 'FAQ - Circles',
    render: () => <FaqTribes />,
  },
  {
    path: '/faq/foundation',
    title: 'FAQ - Foundation',
    render: () => <FaqFoundation />,
  },
  {
    path: '/faq/technology',
    title: 'FAQ - Technology',
    render: () => <FaqTechnology />,
  },
  {
    path: '/foundation',
    title: 'Foundation',
    render: ({ user }) => <Foundation user={user} />,
  },
  {
    path: '/guide',
    title: 'Guide',
    render: () => <Guide />,
  },
  {
    path: '/media',
    title: 'Media',
    render: () => <Media />,
  },
  {
    path: '/privacy',
    title: 'Privacy policy',
    render: () => <Privacy />,
  },
  {
    path: '/rules',
    title: 'Rules',
    render: () => <Rules />,
  },
  {
    path: '/statistics',
    title: 'Statistics',
    render: ({ user }) => <Statistics isAuthenticated={Boolean(user)} />,
  },
  {
    path: '/support',
    title: 'Support',
    render: ({ user }) => <SupportPage user={user} />,
  },
  {
    path: '/team',
    title: 'Team',
    render: ({ user }) => <Team user={user} />,
  },
  {
    path: '/volunteering',
    title: 'Volunteering',
    render: () => <Volunteering />,
  },
];

export function findRoute(path) {
  const normalizedPath = normalizePath(path);

  return routes.find(route => route.path === normalizedPath);
}

export function isReactRoute(path) {
  return REACT_OWNED_PATHS.includes(normalizePath(path));
}
