import { createRoute } from '@tanstack/react-router';
import React from 'react';
import Credits from '@/modules/pages/client/components/Credits.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(routeOptions('/credits', () => <Credits />));
