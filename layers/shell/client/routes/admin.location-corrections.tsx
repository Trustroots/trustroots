import { createFileRoute } from '@tanstack/react-router';
import AdminLocationCorrections from '@/modules/admin/client/components/AdminLocationCorrections.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/location-corrections')(
  routeOptions('/admin/location-corrections', AdminLocationCorrections),
);
