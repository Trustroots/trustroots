import { createRoute } from '@tanstack/react-router';
import React from 'react';
import Privacy from '@/modules/pages/client/components/Privacy.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(routeOptions('/privacy', () => <Privacy />));
