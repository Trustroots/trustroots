import React from 'react';
import ExperienceCreatePage from '@/modules/experiences/client/components/ExperienceCreatePage';
import ContactAddPage from '@/modules/contacts/client/components/ContactAddPage.component';
import ContactConfirmPage from '@/modules/contacts/client/components/ContactConfirmPage.component';
import HomeRoute from '@/modules/pages/client/components/HomeRoute';
import Safety from '@/modules/pages/client/components/Safety.component';
import CirclesRoute from '@/modules/tribes/client/components/CirclesRoute';
import Navigation from '@/modules/pages/client/components/Navigation.component';
import Welcome from '@/modules/users/client/components/Welcome.component';
import SearchUsers from '@/modules/search/client/components/SearchUsers.component';
import { signout } from './shell-helpers';

import {
  getReactRoutePolicy,
  REACT_ROUTE_POLICIES,
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
import NotFoundPage from '@/modules/core/client/components/NotFoundPage.component';
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

function renderCircle({ user, params }) {
  return React.createElement(CirclesRoute, { user, circle: params.circle });
}

function renderNavigation({ user }) {
  return React.createElement(Navigation, { user, onSignout: signout });
}

function renderContactConfirmation({ user }) {
  const contactId = window.location.pathname.split('/')[2];
  return React.createElement(ContactConfirmPage, { user, contactId });
}

function renderContactAdd({ user }) {
  const userId = window.location.pathname.split('/')[2];
  return React.createElement(ContactAddPage, { user, userId });
}

function renderExperienceCreate({ user }) {
  const username = window.location.pathname.split('/')[2];
  return React.createElement(ExperienceCreatePage, { user, username });
}

const renderByPath = {
  '/profile/:username/experiences/new': renderExperienceCreate,
  '/contact-add/:userId': renderContactAdd,
  '/contact-confirm/:contactId': renderContactConfirmation,
  '/': renderWithUser(HomeRoute),
  '/safety': () => <Safety />,
  '/circles': renderWithUser(CirclesRoute),
  '/circles/:circle': renderCircle,
  '/welcome': () => <Welcome />,
  '/navigation': renderNavigation,
  '/search/members': () => <SearchUsers />,
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
  '/not-found': () => <NotFoundPage />,
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
  const policy = getReactRoutePolicy(path);
  if (!policy) return undefined;
  const route = routes.find(route => route.path === policy.path);
  return policy.params
    ? { ...route, params: policy.params, requiresAuth: policy.requiresAuth }
    : route;
}

export function isReactRoute(path) {
  return Boolean(getReactRoutePolicy(path));
}
