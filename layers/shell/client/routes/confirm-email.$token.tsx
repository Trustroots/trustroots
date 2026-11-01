import { createRoute } from '@tanstack/react-router';
import React from 'react';
import ConfirmEmailPage from '@/modules/users/client/components/ConfirmEmailPage.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/confirm-email/:token', () => <ConfirmEmailPage />),
);
