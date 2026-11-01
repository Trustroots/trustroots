import { createRoute } from '@tanstack/react-router';
import React from 'react';
import ForgotPasswordPage from '@/modules/users/client/components/ForgotPasswordPage.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/password/forgot', () => <ForgotPasswordPage />),
);
