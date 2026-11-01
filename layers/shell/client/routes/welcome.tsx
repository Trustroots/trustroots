import { createRoute } from '@tanstack/react-router';
import React from 'react';
import Welcome from '@/modules/users/client/components/Welcome.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(routeOptions('/welcome', () => <Welcome />));
