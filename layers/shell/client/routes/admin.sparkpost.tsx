import { createFileRoute } from '@tanstack/react-router';
import AdminSparkpost from '@/modules/admin/client/components/AdminSparkpost.component';
import { adminPolicy, routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/sparkpost')(
  routeOptions(adminPolicy('Admin - SparkPost'), AdminSparkpost),
);
