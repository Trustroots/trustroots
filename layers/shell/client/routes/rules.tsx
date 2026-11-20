import { createFileRoute } from '@tanstack/react-router';
import Rules from '@/modules/pages/client/components/Rules.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/rules')(routeOptions('/rules', Rules));
