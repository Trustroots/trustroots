import { createFileRoute } from '@tanstack/react-router';
import Foundation from '@/modules/pages/client/components/Foundation.component';
import { withUser } from '../route-options';

export const Route = createFileRoute('/foundation')({
  staticData: { title: 'Foundation' },
  component: withUser(Foundation),
});
