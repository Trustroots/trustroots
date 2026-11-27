import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import { requireAuth } from '../route-options';
import { ThreadRoute } from '@trustroots/messages/route-views';
import ReferenceThread from '@/modules/references-thread/client/components/ReferenceThread';

export const Route = createFileRoute('/messages/$username')({
  staticData: { title: 'Messages', footerHidden: true },
  beforeLoad: requireAuth,
  component: () => <ThreadRoute ReferencePanel={ReferenceThread} />,
});
