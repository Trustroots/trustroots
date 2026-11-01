import { createRoute } from '@tanstack/react-router';
import React from 'react';
import RemoveProfilePage from '@/modules/users/client/components/RemoveProfilePage.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/remove/:token', () => <RemoveProfilePage />),
);
