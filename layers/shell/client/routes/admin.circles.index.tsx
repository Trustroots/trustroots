import { createFileRoute } from '@tanstack/react-router';
import AdminCircles from '@/modules/admin/client/components/AdminCircles.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/circles/')(
  routeOptions('/admin/circles', AdminCircles),
);
