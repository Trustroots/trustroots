import { createFileRoute } from '@tanstack/react-router';
import Media from '@/modules/pages/client/components/Media.component';

export const Route = createFileRoute('/media')({
  staticData: { title: 'Media' },
  component: Media,
});
