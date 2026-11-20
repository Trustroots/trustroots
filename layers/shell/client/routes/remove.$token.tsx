import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import RemoveProfilePage from '@/modules/users/client/components/RemoveProfilePage.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/remove/$token')(
  routeOptions('/remove/:token', () => <RemoveProfilePage />),
);
