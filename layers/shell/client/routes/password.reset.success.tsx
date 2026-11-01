import { createRoute } from '@tanstack/react-router';
import React from 'react';
import ResetPasswordSuccessPage from '@/modules/users/client/components/ResetPasswordSuccessPage.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/password/reset/success', () => <ResetPasswordSuccessPage />),
);
