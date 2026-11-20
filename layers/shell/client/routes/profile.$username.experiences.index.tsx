import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '../route-options';

export const Route = createFileRoute('/profile/$username/experiences/')({
  staticData: { title: 'Experiences', noScrollingTop: true },
  beforeLoad: requireAuth,
});
