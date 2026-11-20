import { createFileRoute } from '@tanstack/react-router';
import AdminAcquisitionStories from '@/modules/admin/client/components/AdminAcquisitionStories.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/acquisition-stories')(
  routeOptions('/admin/acquisition-stories', AdminAcquisitionStories),
);
