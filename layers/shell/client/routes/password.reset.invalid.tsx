import { createRoute } from '@tanstack/react-router';
import React from 'react';
import ResetPasswordInvalidPage from '@/modules/users/client/components/ResetPasswordInvalidPage.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/password/reset/invalid', () => <ResetPasswordInvalidPage />),
);
