import { createFileRoute } from '@tanstack/react-router';
import Greeters from '@/modules/pages/client/components/Greeters.component';
import { withUser } from '../route-options';

export const Route = createFileRoute('/team/greeters')({
  staticData: { title: 'Trustroots greeters' },
  component: withUser(Greeters),
});
