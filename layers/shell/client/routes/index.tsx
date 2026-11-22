import { createFileRoute } from '@tanstack/react-router';
import HomeRoute from '@/modules/pages/client/components/HomeRoute';
import { withUser } from '../route-options';

export const Route = createFileRoute('/')({
  staticData: { title: 'Home', footerHidden: true },
  component: withUser(HomeRoute),
});
