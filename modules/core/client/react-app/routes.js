import React from 'react';

import {
  getReactRoutePolicy,
  REACT_ROUTE_POLICIES,
  normalizePath,
} from '@/modules/core/shared/react-route-ownership';
import Admin from '@/modules/admin/client/components/Admin.component';
import AdminAcquisitionStories from '@/modules/admin/client/components/AdminAcquisitionStories.component';
import AdminAcquisitionStoriesAnalysis from '@/modules/admin/client/components/AdminAcquisitionStoriesAnalysis.component';
import AdminAuditLog from '@/modules/admin/client/components/AdminAuditLog.component';
import AdminMessages from '@/modules/admin/client/components/AdminMessages.component';
import AdminNewsletter from '@/modules/admin/client/components/AdminNewsletter.component';
import AdminReferenceThreads from '@/modules/admin/client/components/AdminReferenceThreads.component';
import AdminSearchUsers from '@/modules/admin/client/components/AdminSearchUsers.component';
import AdminThreads from '@/modules/admin/client/components/AdminThreads.component';
import AdminUser from '@/modules/admin/client/components/AdminUser.component';
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

function renderWithUser(Component) {
  return function renderRoute({ user }) {
    return React.createElement(Component, { user });
  };
}

function renderStatistics({ user }) {
  return React.createElement(Statistics, { isAuthenticated: Boolean(user) });
}

const renderByPath = {
  '/admin': () => <Admin />,
  '/admin/acquisition-stories': () => <AdminAcquisitionStories />,
  '/admin/acquisition-stories/analysis': () => (
    <AdminAcquisitionStoriesAnalysis />
  ),
  '/admin/audit-log': () => <AdminAuditLog />,
  '/admin/messages': () => <AdminMessages />,
  '/admin/newsletter': () => <AdminNewsletter />,
  '/admin/reference-threads': () => <AdminReferenceThreads />,
  '/admin/search-users': () => <AdminSearchUsers />,
  '/admin/threads': () => <AdminThreads />,
  '/admin/user': () => <AdminUser />,
  '/contact': renderWithUser(SupportPage),
  '/contribute': () => <Contribute />,
  '/faq': () => <FaqGeneral />,
  '/faq/bugs-and-features': () => <FaqBugsAndFeatures />,
  '/faq/circles': () => <FaqTribes />,
  '/faq/foundation': () => <FaqFoundation />,
  '/faq/technology': () => <FaqTechnology />,
  '/foundation': renderWithUser(Foundation),
  '/guide': () => <Guide />,
  '/media': () => <Media />,
  '/privacy': () => <Privacy />,
  '/rules': () => <Rules />,
  '/statistics': renderStatistics,
  '/support': renderWithUser(SupportPage),
  '/team': renderWithUser(Team),
  '/volunteering': () => <Volunteering />,
};

export const routes = REACT_ROUTE_POLICIES.map(route => ({
  ...route,
  render: renderByPath[route.path],
}));

export function findRoute(path) {
  const normalizedPath = normalizePath(path);

  return routes.find(route => route.path === normalizedPath);
}

export function isReactRoute(path) {
  return Boolean(getReactRoutePolicy(path));
}
