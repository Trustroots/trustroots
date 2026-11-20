import { createFileRoute } from '@tanstack/react-router';
import AdminGravatar from '@/modules/admin/client/components/AdminGravatar.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/gravatar')(
  routeOptions('/admin/gravatar', AdminGravatar),
);
