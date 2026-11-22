import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '../route-options';

export const Route = createFileRoute('/profile/$username/contacts')({
  staticData: { title: 'Profile contacts', noScrollingTop: true },
  beforeLoad: requireAuth,
});
