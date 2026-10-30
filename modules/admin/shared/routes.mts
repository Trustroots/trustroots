import type { ReactRoutePolicy } from '../../core/shared/react-route-ownership.mts';

// Every admin route requires sign-in and the admin role unless it says otherwise.
const ADMIN_ROUTE_DEFAULTS = {
  footerVariant: 'admin',
  requiresAuth: true,
  requiresRole: 'admin',
};

export const ADMIN_ROUTE_POLICIES: ReactRoutePolicy[] = [
  { path: '/admin', title: 'Admin' },
  {
    path: '/admin/support',
    requiresRole: ['admin', 'support-team'],
    title: 'Support',
  },
  {
    path: '/admin/support/requests/:requestId',
    requiresRole: ['admin', 'support-team'],
    title: 'Support request',
  },
  {
    path: '/admin/support/members',
    requiresRole: ['admin', 'support-team'],
    title: 'Support - Member search',
  },
  {
    path: '/admin/support/member/:username',
    requiresRole: ['admin', 'support-team'],
    title: 'Support - Member',
  },
  { path: '/admin/hackerspaces', title: 'Admin - Hackerspaces' },
  { path: '/admin/audit-log', title: 'Admin - Audit log' },
  {
    path: '/admin/username-changes',
    requiresRole: ['admin'],
    title: 'Admin - Username changes',
  },
  {
    path: '/admin/spam-cleanup',
    requiresRole: ['admin'],
    title: 'Admin - Spam account cleanup',
  },
  {
    path: '/admin/acquisition-stories',
    requiresRole: ['admin', 'welcome-team', 'support-team'],
    title: 'Admin - Acquisition stories',
  },
  {
    path: '/admin/staff-blockers',
    requiresRole: ['admin', 'welcome-team', 'support-team'],
    title: 'Admin - Staff blockers',
  },
  {
    path: '/admin/location-corrections',
    requiresRole: ['admin', 'welcome-team'],
    title: 'Welcome team - Location corrections',
  },
  { path: '/admin/messages', title: 'Admin - Messages' },
  { path: '/admin/threads', title: 'Admin - Threads' },
  { path: '/admin/search-users', title: 'Admin - Search users' },
  { path: '/admin/user', title: 'Admin - User' },
  { path: '/admin/user/:username', title: 'Admin - User' },
  { path: '/admin/reference-threads', title: 'Admin - Reference threads' },
  {
    path: '/admin/experience-changes',
    requiresRole: ['admin', 'support-team'],
    title: 'Admin - Experience changes',
  },
  { path: '/admin/newsletter', title: 'Admin - Newsletter' },
  { path: '/admin/circles', title: 'Admin - Circles' },
  { path: '/admin/circles/:circle', title: 'Admin - Circle' },
].map(policy => ({ ...ADMIN_ROUTE_DEFAULTS, ...policy }));
