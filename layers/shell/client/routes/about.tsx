import { createFileRoute } from '@tanstack/react-router';
import HomeRoute from '@/modules/pages/client/components/HomeRoute';
import { redirectTo, withUser } from '../route-options';

export const Route = createFileRoute('/about')({
  staticData: { title: 'About', footerHidden: true },
  beforeLoad: redirectTo('/'),
  component: withUser(HomeRoute),
});
