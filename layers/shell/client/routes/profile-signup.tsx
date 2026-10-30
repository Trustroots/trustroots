import { createRoute } from '@tanstack/react-router';
import React from 'react';
import ProfileSignupPage from '@/modules/users/client/components/ProfileSignupPage.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/profile-signup', () => <ProfileSignupPage />),
);
