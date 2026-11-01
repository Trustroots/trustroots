import { createRoute } from '@tanstack/react-router';
import React from 'react';
import Volunteering from '@/modules/pages/client/components/Volunteering.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/volunteering', () => <Volunteering />),
);
