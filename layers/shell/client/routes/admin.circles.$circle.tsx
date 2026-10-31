import { createRoute } from '@tanstack/react-router';
import React from 'react';
import AdminCircles from '@/modules/admin/client/components/AdminCircles.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/admin/circles/:circle', ({ params, navigate }) => (
    <AdminCircles circleSlug={params.circle} onNavigate={navigate} />
  )),
);
