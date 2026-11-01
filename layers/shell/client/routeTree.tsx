import type { ShellRoute } from './route-options';
import { Route as rootRoute } from './routes/__root';
import { Route as IndexRoute } from './routes/index';
import { Route as AboutRoute } from './routes/about';
import { Route as ContactRoute } from './routes/contact';
import { Route as ContributeRoute } from './routes/contribute';
import { Route as CreditsRoute } from './routes/credits';
import { Route as FaqIndexRoute } from './routes/faq.index';
import { Route as FaqBugsAndFeaturesRoute } from './routes/faq.bugs-and-features';
import { Route as FaqCirclesRoute } from './routes/faq.circles';
import { Route as FaqFoundationRoute } from './routes/faq.foundation';
import { Route as FaqTechnologyRoute } from './routes/faq.technology';
import { Route as FoundationRoute } from './routes/foundation';
import { Route as GuideRoute } from './routes/guide';
import { Route as MediaRoute } from './routes/media';
import { Route as NavigationRoute } from './routes/navigation';
import { Route as NotFoundRoute } from './routes/not-found';
import { Route as PrivacyRoute } from './routes/privacy';
import { Route as RulesRoute } from './routes/rules';
import { Route as SafetyRoute } from './routes/safety';
import { Route as StatisticsRoute } from './routes/statistics';
import { Route as SupportRoute } from './routes/support';
import { Route as TeamIndexRoute } from './routes/team.index';
import { Route as TeamGreetersRoute } from './routes/team.greeters';
import { Route as VolunteeringRoute } from './routes/volunteering';
import { Route as WelcomeRoute } from './routes/welcome';
import { Route as CirclesIndexRoute } from './routes/circles.index';
import { Route as CirclesCircleRoute } from './routes/circles.$circle';
import { Route as MessagesIndexRoute } from './routes/messages.index';
import { Route as MessagesUsernameRoute } from './routes/messages.$username';
import { Route as SearchIndexRoute } from './routes/search.index';
import { Route as SearchMembersRoute } from './routes/search.members';
import { Route as ProfileUsernameExperiencesNewRoute } from './routes/profile.$username.experiences.new';
import { Route as ExperiencesIdChangeRoute } from './routes/experiences.$id.change';
import { Route as ProfileUsernameExperiencesIndexRoute } from './routes/profile.$username.experiences.index';
import { Route as ProfileUsernameAccommodationRoute } from './routes/profile.$username.accommodation';
import { Route as ProfileUsernameAboutRoute } from './routes/profile.$username.about';
import { Route as ProfileUsernameOverviewRoute } from './routes/profile.$username.overview';
import { Route as ProfileUsernameContactsRoute } from './routes/profile.$username.contacts';
import { Route as ProfileUsernameTribesRoute } from './routes/profile.$username.tribes';
import { Route as ProfileUsernameRoute } from './routes/profile.$username';
import { Route as ProfileEditLocationsRoute } from './routes/profile.edit.locations';
import { Route as ProfileEditPhotoRoute } from './routes/profile.edit.photo';
import { Route as ProfileEditNetworksRoute } from './routes/profile.edit.networks';
import { Route as ProfileEditAccountRoute } from './routes/profile.edit.account';
import { Route as ProfileEditIndexRoute } from './routes/profile.edit.index';
import { Route as ContactAddUserIdRoute } from './routes/contact-add.$userId';
import { Route as ContactConfirmContactIdRoute } from './routes/contact-confirm.$contactId';
import { Route as OfferIndexRoute } from './routes/offer.index';
import { Route as OfferHostRoute } from './routes/offer.host';
import { Route as OfferMeetIndexRoute } from './routes/offer.meet.index';
import { Route as OfferMeetAddRoute } from './routes/offer.meet.add';
import { Route as OfferMeetOfferIdRoute } from './routes/offer.meet.$offerId';
import { Route as SigninRoute } from './routes/signin';
import { Route as SignupRoute } from './routes/signup';
import { Route as ConfirmEmailTokenRoute } from './routes/confirm-email.$token';
import { Route as ConfirmEmailInvalidRoute } from './routes/confirm-email-invalid';
import { Route as PasswordForgotRoute } from './routes/password.forgot';
import { Route as PasswordResetInvalidRoute } from './routes/password.reset.invalid';
import { Route as PasswordResetSuccessRoute } from './routes/password.reset.success';
import { Route as PasswordResetTokenRoute } from './routes/password.reset.$token';
import { Route as RemoveTokenRoute } from './routes/remove.$token';
import { Route as ProfileSignupRoute } from './routes/profile-signup';
import { Route as AdminIndexRoute } from './routes/admin.index';
import { Route as AdminSupportIndexRoute } from './routes/admin.support.index';
import { Route as AdminSupportRequestsRequestIdRoute } from './routes/admin.support.requests.$requestId';
import { Route as AdminSupportMembersRoute } from './routes/admin.support.members';
import { Route as AdminSupportMemberUsernameRoute } from './routes/admin.support.member.$username';
import { Route as AdminHackerspacesRoute } from './routes/admin.hackerspaces';
import { Route as AdminAuditLogRoute } from './routes/admin.audit-log';
import { Route as AdminUsernameChangesRoute } from './routes/admin.username-changes';
import { Route as AdminSpamCleanupRoute } from './routes/admin.spam-cleanup';
import { Route as AdminAcquisitionStoriesRoute } from './routes/admin.acquisition-stories';
import { Route as AdminStaffBlockersRoute } from './routes/admin.staff-blockers';
import { Route as AdminLocationCorrectionsRoute } from './routes/admin.location-corrections';
import { Route as AdminMessagesRoute } from './routes/admin.messages';
import { Route as AdminThreadsRoute } from './routes/admin.threads';
import { Route as AdminSearchUsersRoute } from './routes/admin.search-users';
import { Route as AdminUserIndexRoute } from './routes/admin.user.index';
import { Route as AdminUserUsernameRoute } from './routes/admin.user.$username';
import { Route as AdminReferenceThreadsRoute } from './routes/admin.reference-threads';
import { Route as AdminExperienceChangesRoute } from './routes/admin.experience-changes';
import { Route as AdminNewsletterRoute } from './routes/admin.newsletter';
import { Route as AdminSparkpostRoute } from './routes/admin.sparkpost';
import { Route as AdminCirclesIndexRoute } from './routes/admin.circles.index';
import { Route as AdminCirclesCircleRoute } from './routes/admin.circles.$circle';

const rootChildren = [
  IndexRoute,
  AboutRoute,
  ContactRoute,
  ContributeRoute,
  CreditsRoute,
  FaqIndexRoute,
  FaqBugsAndFeaturesRoute,
  FaqCirclesRoute,
  FaqFoundationRoute,
  FaqTechnologyRoute,
  FoundationRoute,
  GuideRoute,
  MediaRoute,
  NavigationRoute,
  NotFoundRoute,
  PrivacyRoute,
  RulesRoute,
  SafetyRoute,
  StatisticsRoute,
  SupportRoute,
  TeamIndexRoute,
  TeamGreetersRoute,
  VolunteeringRoute,
  WelcomeRoute,
  CirclesIndexRoute,
  CirclesCircleRoute,
  MessagesIndexRoute,
  MessagesUsernameRoute,
  SearchIndexRoute,
  SearchMembersRoute,
  ExperiencesIdChangeRoute,
  ProfileEditLocationsRoute,
  ProfileEditPhotoRoute,
  ProfileEditNetworksRoute,
  ProfileEditAccountRoute,
  ProfileEditIndexRoute,
  ContactAddUserIdRoute,
  ContactConfirmContactIdRoute,
  OfferIndexRoute,
  OfferHostRoute,
  OfferMeetIndexRoute,
  OfferMeetAddRoute,
  OfferMeetOfferIdRoute,
  SigninRoute,
  SignupRoute,
  ConfirmEmailTokenRoute,
  ConfirmEmailInvalidRoute,
  PasswordForgotRoute,
  PasswordResetInvalidRoute,
  PasswordResetSuccessRoute,
  PasswordResetTokenRoute,
  RemoveTokenRoute,
  ProfileSignupRoute,
  AdminIndexRoute,
  AdminSupportIndexRoute,
  AdminSupportRequestsRequestIdRoute,
  AdminSupportMembersRoute,
  AdminSupportMemberUsernameRoute,
  AdminHackerspacesRoute,
  AdminAuditLogRoute,
  AdminUsernameChangesRoute,
  AdminSpamCleanupRoute,
  AdminAcquisitionStoriesRoute,
  AdminStaffBlockersRoute,
  AdminLocationCorrectionsRoute,
  AdminMessagesRoute,
  AdminThreadsRoute,
  AdminSearchUsersRoute,
  AdminUserIndexRoute,
  AdminUserUsernameRoute,
  AdminReferenceThreadsRoute,
  AdminExperienceChangesRoute,
  AdminNewsletterRoute,
  AdminSparkpostRoute,
  AdminCirclesIndexRoute,
  AdminCirclesCircleRoute,
];
const profileTabs = [
  ProfileUsernameExperiencesNewRoute,
  ProfileUsernameExperiencesIndexRoute,
  ProfileUsernameAccommodationRoute,
  ProfileUsernameAboutRoute,
  ProfileUsernameOverviewRoute,
  ProfileUsernameContactsRoute,
  ProfileUsernameTribesRoute,
];

export const routeTree = rootRoute.addChildren([
  ...rootChildren,
  ProfileUsernameRoute.addChildren(profileTabs),
]);

// Every shell route with its policy and renderer.
export const routes = [
  ...rootChildren,
  ProfileUsernameRoute,
  ...profileTabs,
].map(route => route.options.staticData as ShellRoute);
