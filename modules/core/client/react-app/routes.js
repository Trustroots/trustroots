import React from 'react';
import PropTypes from 'prop-types';

import {
  matchReactRoute,
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
import NotFoundPage from '@/modules/core/client/components/NotFoundPage.component';
import Home from '@/modules/pages/client/components/Home.component';
import Navigation from '@/modules/pages/client/components/Navigation.component';
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
import Welcome from '@/modules/users/client/components/Welcome.component';
import Inbox from '@/modules/messages/client/components/Inbox.component';
import Thread from '@/modules/messages/client/components/Thread.component';
import SearchUsers from '@/modules/search/client/components/SearchUsers.component';
import SearchPage from '@/modules/search/client/components/SearchPage.component';
import OfferShell from '@/modules/offers/client/components/OfferShell.component';
import OfferRedirectPage from '@/modules/offers/client/components/OfferRedirectPage.component';
import OfferHostPage from '@/modules/offers/client/components/OfferHostPage.component';
import OfferMeetListPage from '@/modules/offers/client/components/OfferMeetListPage.component';
import OfferMeetEditPage from '@/modules/offers/client/components/OfferMeetEditPage.component';
import SigninPage from '@/modules/users/client/components/SigninPage.component';
import SignupPage from '@/modules/users/client/components/SignupPage.component';
import ConfirmEmailPage from '@/modules/users/client/components/ConfirmEmailPage.component';
import ConfirmEmailInvalidPage from '@/modules/users/client/components/ConfirmEmailInvalidPage.component';
import ForgotPasswordPage from '@/modules/users/client/components/ForgotPasswordPage.component';
import ResetPasswordPage from '@/modules/users/client/components/ResetPasswordPage.component';
import ResetPasswordSuccessPage from '@/modules/users/client/components/ResetPasswordSuccessPage.component';
import ResetPasswordInvalidPage from '@/modules/users/client/components/ResetPasswordInvalidPage.component';
import RemoveProfilePage from '@/modules/users/client/components/RemoveProfilePage.component';
import ProfileSignupPage from '@/modules/users/client/components/ProfileSignupPage.component';
import ProfilePage from '@/modules/users/client/components/ProfilePage.component';
import ProfileEditAbout from '@/modules/users/client/components/ProfileEditAbout.component';
import ProfileEditLocations from '@/modules/users/client/components/ProfileEditLocations.component';
import ProfileEditPhoto from '@/modules/users/client/components/ProfileEditPhoto.component';
import ProfileEditNetworks from '@/modules/users/client/components/ProfileEditNetworks.component';
import ProfileEditAccount from '@/modules/users/client/components/ProfileEditAccount.component';
import ContactAddPage from '@/modules/contacts/client/components/ContactAddPage.component';
import ContactConfirmPage from '@/modules/contacts/client/components/ContactConfirmPage.component';
import TribesPage from '@/modules/tribes/client/components/TribesPage.component';
import TribeDetailPage from '@/modules/tribes/client/components/TribeDetailPage.component';
import { useAuth } from './auth';
import { useAppConfig, useSettings } from './AppProviders';
import { signout } from './shell-helpers';

function renderWithUser(Component) {
  return function renderRoute({ user }) {
    return React.createElement(Component, { user });
  };
}

function renderStatistics({ user }) {
  return React.createElement(Statistics, { isAuthenticated: Boolean(user) });
}

function renderOfferPage(Component) {
  return function renderRoute({ user }) {
    return (
      <OfferShell user={user}>
        <Component user={user} />
      </OfferShell>
    );
  };
}

function HomeRoute({ user }) {
  const { isNativeMobileApp } = useAppConfig();
  const { build } = useSettings();

  return (
    <Home
      build={build}
      isNativeMobileApp={isNativeMobileApp}
      photoCredits={{}}
      user={user}
    />
  );
}

HomeRoute.propTypes = {
  user: PropTypes.object,
};

function NavigationRoute({ user }) {
  const { isNativeMobileApp } = useAppConfig();

  return (
    <Navigation
      isNativeMobileApp={isNativeMobileApp}
      onSignout={signout}
      user={user}
    />
  );
}

NavigationRoute.propTypes = {
  user: PropTypes.object,
};

function TribesPageRoute({ user }) {
  const { setUser } = useAuth();

  const handleMembershipUpdated = data => {
    /* istanbul ignore else -- malformed membership callbacks cannot update auth state. */
    if (data?.user) {
      setUser(data.user);
    }
  };

  return (
    <TribesPage onMembershipUpdated={handleMembershipUpdated} user={user} />
  );
}

TribesPageRoute.propTypes = {
  user: PropTypes.object,
};

function TribeDetailPageRoute({ user }) {
  const { setUser } = useAuth();

  const handleMembershipUpdated = data => {
    /* istanbul ignore else -- malformed membership callbacks cannot update auth state. */
    if (data?.user) {
      setUser(data.user);
    }
  };

  return (
    <TribeDetailPage
      onMembershipUpdated={handleMembershipUpdated}
      user={user}
    />
  );
}

TribeDetailPageRoute.propTypes = {
  user: PropTypes.object,
};

function ThreadRoute({ user }) {
  /* istanbul ignore next -- app settings always provide this default in production. */
  const { profileMinimumLength = 140 } = useSettings();

  return <Thread profileMinimumLength={profileMinimumLength} user={user} />;
}

ThreadRoute.propTypes = {
  user: PropTypes.object,
};

const renderByPath = {
  '/': renderWithUser(HomeRoute),
  '/about': renderWithUser(HomeRoute),
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
  '/circles': renderWithUser(TribesPageRoute),
  '/circles/:circle': renderWithUser(TribeDetailPageRoute),
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
  '/messages': renderWithUser(Inbox),
  '/messages/:username': renderWithUser(ThreadRoute),
  '/navigation': renderWithUser(NavigationRoute),
  '/not-found': () => <NotFoundPage />,
  '/offer': () => <OfferRedirectPage />,
  '/offer/host': renderOfferPage(OfferHostPage),
  '/offer/meet': renderOfferPage(OfferMeetListPage),
  '/offer/meet/add': renderOfferPage(OfferMeetEditPage),
  '/offer/meet/:offerId': renderOfferPage(OfferMeetEditPage),
  '/password/forgot': () => <ForgotPasswordPage />,
  '/password/reset/invalid': () => <ResetPasswordInvalidPage />,
  '/password/reset/success': () => <ResetPasswordSuccessPage />,
  '/password/reset/:token': () => <ResetPasswordPage />,
  '/privacy': () => <Privacy />,
  '/profile-signup': () => <ProfileSignupPage />,
  '/profile/:username/experiences/new': renderWithUser(ProfilePage),
  '/profile/:username/experiences': renderWithUser(ProfilePage),
  '/profile/:username/accommodation': renderWithUser(ProfilePage),
  '/profile/:username/overview': renderWithUser(ProfilePage),
  '/profile/:username/contacts': renderWithUser(ProfilePage),
  '/profile/:username/tribes': renderWithUser(ProfilePage),
  '/profile/:username': renderWithUser(ProfilePage),
  '/profile/edit/locations': renderWithUser(ProfileEditLocations),
  '/profile/edit/photo': renderWithUser(ProfileEditPhoto),
  '/profile/edit/networks': renderWithUser(ProfileEditNetworks),
  '/profile/edit/account': renderWithUser(ProfileEditAccount),
  '/profile/edit': renderWithUser(ProfileEditAbout),
  '/contact-add/:userId': renderWithUser(ContactAddPage),
  '/contact-confirm/:contactId': renderWithUser(ContactConfirmPage),
  '/remove/:token': () => <RemoveProfilePage />,
  '/rules': () => <Rules />,
  '/search': renderWithUser(SearchPage),
  '/search/members': () => <SearchUsers />,
  '/signin': () => <SigninPage />,
  '/signup': () => <SignupPage />,
  '/confirm-email/:token': () => <ConfirmEmailPage />,
  '/confirm-email-invalid': () => <ConfirmEmailInvalidPage />,
  '/statistics': renderStatistics,
  '/support': renderWithUser(SupportPage),
  '/team': renderWithUser(Team),
  '/volunteering': () => <Volunteering />,
  '/welcome': () => <Welcome />,
};

export const routes = REACT_ROUTE_POLICIES.map(route => ({
  ...route,
  render: renderByPath[route.path],
}));

export function findRoute(path) {
  const matched = matchReactRoute(path);

  if (!matched) {
    return undefined;
  }

  return {
    ...matched.policy,
    params: matched.params,
    render: renderByPath[matched.policy.path],
  };
}

export function isReactRoute(path) {
  return Boolean(matchReactRoute(path));
}

export { normalizePath };
