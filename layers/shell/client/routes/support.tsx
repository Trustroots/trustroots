import { createFileRoute } from '@tanstack/react-router';
import SupportPage from '@/modules/support/client/components/SupportPage.component';
import { routeOptions, renderWithUser } from '../route-options';

export const Route = createFileRoute('/support')(
  routeOptions('/support', renderWithUser(SupportPage)),
);
