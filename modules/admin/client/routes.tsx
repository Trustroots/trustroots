import React from 'react';

import type { AuthUser } from '@/modules/core/client/react-app/auth';
import type { RouteRender } from '@/modules/core/client/react-app/route-render';
import AdminSpamCleanup from '@/modules/admin/client/components/AdminSpamCleanup';
import Admin from '@/modules/admin/client/components/Admin.component';
import SupportInbox, {
  SupportMemberPage,
  SupportMemberSearchPage,
} from '@/modules/admin/client/components/Support.component';
import AdminCircles from '@/modules/admin/client/components/AdminCircles.component';
import AdminHackerspaces from '@/modules/admin/client/components/AdminHackerspaces.component';
import AdminStaffBlockers from '@/modules/admin/client/components/AdminStaffBlockers.component';
import AdminAcquisitionStories from '@/modules/admin/client/components/AdminAcquisitionStories.component';
import AdminAuditLog from '@/modules/admin/client/components/AdminAuditLog.component';
import AdminUsernameChanges from '@/modules/admin/client/components/AdminUsernameChanges.component';
import AdminMessages from '@/modules/admin/client/components/AdminMessages.component';
import AdminLocationCorrections from '@/modules/admin/client/components/AdminLocationCorrections.component';
import AdminNewsletter from '@/modules/admin/client/components/AdminNewsletter.component';
import AdminReferenceThreads from '@/modules/admin/client/components/AdminReferenceThreads.component';
import AdminExperienceChanges from '@/modules/admin/client/components/AdminExperienceChanges';
import AdminSearchUsers from '@/modules/admin/client/components/AdminSearchUsers.component';
import AdminThreads from '@/modules/admin/client/components/AdminThreads.component';
import AdminUser from '@/modules/admin/client/components/AdminUser.component';

export const adminRoutes: Record<string, RouteRender> = {
  '/admin': () => <Admin />,
  '/admin/support': () => <SupportInbox />,
  '/admin/support/members': () => <SupportMemberSearchPage />,
  '/admin/support/requests/:requestId': ({ params }) => (
    <SupportInbox requestId={params.requestId} />
  ),
  '/admin/support/member/:username': ({ params }) => (
    <SupportMemberPage id={params.username} />
  ),
  '/admin/circles': ({ navigate }) => <AdminCircles onNavigate={navigate} />,
  '/admin/circles/:circle': ({ params, navigate }) => (
    <AdminCircles circleSlug={params.circle} onNavigate={navigate} />
  ),
  '/admin/hackerspaces': () => <AdminHackerspaces />,
  '/admin/staff-blockers': () => <AdminStaffBlockers />,
  '/admin/acquisition-stories': () => <AdminAcquisitionStories />,
  '/admin/audit-log': () => <AdminAuditLog />,
  '/admin/spam-cleanup': () => <AdminSpamCleanup />,
  '/admin/username-changes': () => <AdminUsernameChanges />,
  '/admin/messages': () => <AdminMessages />,
  '/admin/location-corrections': () => <AdminLocationCorrections />,
  '/admin/experience-changes': () => <AdminExperienceChanges />,
  '/admin/newsletter': () => <AdminNewsletter />,
  '/admin/reference-threads': () => <AdminReferenceThreads />,
  '/admin/search-users': () => <AdminSearchUsers />,
  '/admin/threads': () => <AdminThreads />,
  '/admin/user': ({ user }) => <AdminUser viewer={user as AuthUser} />,
  '/admin/user/:username': ({ params, user }) => (
    <AdminUser username={params.username} viewer={user as AuthUser} />
  ),
};
