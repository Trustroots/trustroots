import { createFileRoute } from '@tanstack/react-router';
import { redirectTo } from '../route-options';

export const Route = createFileRoute('/volunteers')({
  staticData: { title: 'Volunteering' },
  beforeLoad: redirectTo('/volunteering'),
});
