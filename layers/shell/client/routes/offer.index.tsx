import { createFileRoute } from '@tanstack/react-router';
import { routeOptions } from '../route-options';

// The /offer policy redirects to /offer/host before this route renders.
export const Route = createFileRoute('/offer/')(routeOptions('/offer'));
