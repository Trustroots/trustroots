import { createRoute } from '@tanstack/react-router';
import React from 'react';
import Admin from '@/modules/admin/client/components/Admin.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(routeOptions('/admin', () => <Admin />));
