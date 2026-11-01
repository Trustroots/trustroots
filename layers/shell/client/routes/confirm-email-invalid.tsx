import { createRoute } from '@tanstack/react-router';
import React from 'react';
import ConfirmEmailInvalidPage from '@/modules/users/client/components/ConfirmEmailInvalidPage.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/confirm-email-invalid', () => <ConfirmEmailInvalidPage />),
);
