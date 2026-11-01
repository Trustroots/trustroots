import { createRoute } from '@tanstack/react-router';
import React from 'react';
import Contribute from '@/modules/pages/client/components/Contribute.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/contribute', () => <Contribute />),
);
