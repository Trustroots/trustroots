import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import AdminCircles from '@/modules/admin/client/components/AdminCircles.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/circles/')(
  routeOptions('/admin/circles', ({ navigate }) => (
    <AdminCircles onNavigate={navigate} />
  )),
);
