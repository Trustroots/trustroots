import { createFileRoute } from '@tanstack/react-router';
import Guide from '@/modules/pages/client/components/Guide.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/guide')(routeOptions('/guide', Guide));
