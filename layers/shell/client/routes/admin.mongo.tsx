import { createFileRoute } from '@tanstack/react-router';
import AdminMongo from '@/modules/admin/client/components/AdminMongo.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/mongo')(
  routeOptions('/admin/mongo', AdminMongo),
);
