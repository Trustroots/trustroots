import { createFileRoute } from '@tanstack/react-router';
import SupportPage from '@/modules/support/client/components/SupportPage.component';
import { routeOptions, withUser } from '../route-options';

export const Route = createFileRoute('/support')(
  routeOptions({ title: 'Support' }, withUser(SupportPage)),
);
