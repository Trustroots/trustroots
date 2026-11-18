import {
  createFileRoute,
  useNavigate,
  useParams,
} from '@tanstack/react-router';
import React from 'react';
import AdminCircles from '@/modules/admin/client/components/AdminCircles.component';
import { routeOptions } from '../route-options';

export function AdminCirclesRoute() {
  const navigate = useNavigate();
  const { circle } = useParams({ strict: false });
  return (
    <AdminCircles
      circleSlug={circle}
      onNavigate={to => void navigate({ to })}
    />
  );
}

export const Route = createFileRoute('/admin/circles/$circle')(
  routeOptions('/admin/circles/:circle', AdminCirclesRoute),
);
