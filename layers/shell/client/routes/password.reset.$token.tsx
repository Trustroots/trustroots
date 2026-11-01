import { createRoute } from '@tanstack/react-router';
import React from 'react';
import ResetPasswordPage from '@/modules/users/client/components/ResetPasswordPage.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/password/reset/:token', () => <ResetPasswordPage />),
);
