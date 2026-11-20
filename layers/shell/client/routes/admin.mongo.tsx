import { createFileRoute } from '@tanstack/react-router';
import AdminMongo from '@/modules/admin/client/components/AdminMongo.component';
import { adminPolicy, routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/mongo')(
  routeOptions(adminPolicy('Admin - MongoDB diagnostics'), AdminMongo),
);
