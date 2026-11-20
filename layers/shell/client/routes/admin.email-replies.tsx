import { createFileRoute } from '@tanstack/react-router';
import AdminEmailReplies from '@/modules/admin/client/components/AdminEmailReplies.component';
import { adminPolicy, routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/email-replies')(
  routeOptions(adminPolicy('Admin - Email replies'), AdminEmailReplies),
);
