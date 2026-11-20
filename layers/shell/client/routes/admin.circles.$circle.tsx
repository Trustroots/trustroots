import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import AdminCircles from '@/modules/admin/client/components/AdminCircles.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/circles/$circle')(
  routeOptions('/admin/circles/:circle', ({ params, navigate }) => (
    <AdminCircles circleSlug={params.circle} onNavigate={navigate} />
  )),
);
