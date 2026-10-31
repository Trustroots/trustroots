import type { ReactRoutePolicy } from '../../core/shared/react-route-ownership.mts';

const ACCOUNT_ACCESS_FOOTER = { footerVariant: 'account' };

export const USERS_ROUTE_POLICIES: ReactRoutePolicy[] = [
  {
    path: '/welcome',
    title: 'Welcome',
    requiresAuth: true,
    footerHidden: true,
  },
  {
    path: '/profile/:username/experiences/new',
    title: 'Share your experience',
    requiresAuth: true,
    noScrollingTop: true,
  },
  {
    path: '/profile/:username/experiences',
    title: 'Experiences',
    requiresAuth: true,
    noScrollingTop: true,
  },
  {
    path: '/profile/:username/accommodation',
    title: 'Profile accommodation',
    requiresAuth: true,
    noScrollingTop: true,
  },
  {
    path: '/profile/:username/about',
    title: 'Profile',
    requiresAuth: true,
    noScrollingTop: true,
  },
  {
    path: '/profile/:username/overview',
    title: 'Profile overview',
    requiresAuth: true,
    noScrollingTop: true,
  },
  {
    path: '/profile/:username/contacts',
    title: 'Profile contacts',
    requiresAuth: true,
    noScrollingTop: true,
  },
  {
    path: '/profile/:username/tribes',
    title: 'Profile tribes',
    requiresAuth: true,
    noScrollingTop: true,
  },
  {
    path: '/profile/:username',
    title: 'Profile',
    requiresAuth: true,
    noScrollingTop: true,
  },
  {
    path: '/profile/edit/locations',
    title: 'Edit your locations',
    requiresAuth: true,
  },
  {
    path: '/profile/edit/photo',
    title: 'Edit profile photo',
    requiresAuth: true,
  },
  {
    path: '/profile/edit/networks',
    title: 'Edit Profile networks',
    requiresAuth: true,
  },
  { path: '/profile/edit/account', title: 'Account', requiresAuth: true },
  { path: '/profile/edit', title: 'Edit profile', requiresAuth: true },
  {
    path: '/signin',
    title: 'Sign in',
    headerHidden: true,
    ...ACCOUNT_ACCESS_FOOTER,
  },
  {
    path: '/signup',
    title: 'Sign up',
    headerHidden: true,
    ...ACCOUNT_ACCESS_FOOTER,
  },
  { path: '/confirm-email/:token', title: 'Confirm email' },
  { path: '/confirm-email-invalid', title: 'Confirm email invalid' },
  {
    path: '/password/forgot',
    title: 'Reset password',
    ...ACCOUNT_ACCESS_FOOTER,
  },
  {
    path: '/password/reset/invalid',
    title: 'Reset password',
    ...ACCOUNT_ACCESS_FOOTER,
  },
  {
    path: '/password/reset/success',
    title: 'Reset password',
    ...ACCOUNT_ACCESS_FOOTER,
  },
  {
    path: '/password/reset/:token',
    title: 'Reset password',
    ...ACCOUNT_ACCESS_FOOTER,
  },
  {
    path: '/remove/:token',
    title: 'Remove profile',
    requiresAuth: true,
    headerHidden: true,
    footerHidden: true,
  },
  { path: '/profile-signup', title: 'Trustroots profile' },
];
