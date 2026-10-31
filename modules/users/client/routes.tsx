import React from 'react';

import {
  renderWithUser,
  type RouteRender,
} from '@/modules/core/client/react-app/route-render';
import Welcome from '@/modules/users/client/components/Welcome.component';
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

export const usersRoutes: Record<string, RouteRender> = {
  '/password/forgot': () => <ForgotPasswordPage />,
  '/password/reset/invalid': () => <ResetPasswordInvalidPage />,
  '/password/reset/success': () => <ResetPasswordSuccessPage />,
  '/password/reset/:token': () => <ResetPasswordPage />,
  '/profile-signup': () => <ProfileSignupPage />,
  '/profile/:username': ({ currentPath, user }) => (
    <ProfilePage
      currentPath={currentPath}
      user={user as React.ComponentProps<typeof ProfilePage>['user']}
    />
  ),
  '/profile/edit/locations': renderWithUser(ProfileEditLocations),
  '/profile/edit/photo': renderWithUser(ProfileEditPhoto),
  '/profile/edit/networks': renderWithUser(ProfileEditNetworks),
  '/profile/edit/account': renderWithUser(ProfileEditAccount),
  '/profile/edit': renderWithUser(ProfileEditAbout),
  '/remove/:token': () => <RemoveProfilePage />,
  '/signin': () => <SigninPage />,
  '/signup': () => <SignupPage />,
  '/confirm-email/:token': () => <ConfirmEmailPage />,
  '/confirm-email-invalid': () => <ConfirmEmailInvalidPage />,
  '/welcome': () => <Welcome />,
};
