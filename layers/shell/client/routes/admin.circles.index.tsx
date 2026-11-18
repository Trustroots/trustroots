import { createFileRoute } from '@tanstack/react-router';
import { routeOptions } from '../route-options';
import { AdminCirclesRoute } from './admin.circles.$circle';

export const Route = createFileRoute('/admin/circles/')(
  routeOptions('/admin/circles', AdminCirclesRoute),
);
