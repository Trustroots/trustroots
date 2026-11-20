import { createFileRoute } from '@tanstack/react-router';
import AdminHackerspaces from '@/modules/admin/client/components/AdminHackerspaces.component';
import { adminPolicy, routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/hackerspaces')(
  routeOptions(adminPolicy('Admin - Hackerspaces'), AdminHackerspaces),
);
