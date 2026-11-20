import { createFileRoute } from '@tanstack/react-router';
import AdminLocationCorrections from '@/modules/admin/client/components/AdminLocationCorrections.component';
import { adminPolicy, routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/location-corrections')(
  routeOptions(
    adminPolicy('Welcome team - Location corrections', [
      'admin',
      'welcome-team',
    ]),
    AdminLocationCorrections,
  ),
);
