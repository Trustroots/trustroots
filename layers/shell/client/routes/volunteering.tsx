import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import Volunteering from '@/modules/pages/client/components/Volunteering.component';
import TopicChat from '@/modules/tribes/client/components/TopicChat';
import { useAuth } from '@/modules/core/client/react-app/auth';

function VolunteeringRoute() {
  const { user } = useAuth();
  return (
    <Volunteering>
      <TopicChat
        key={user?._id || 'visitor'}
        roomName="volunteering"
        user={user?._id ? { _id: user._id } : undefined}
      />
    </Volunteering>
  );
}

export const Route = createFileRoute('/volunteering')({
  staticData: { title: 'Volunteering' },
  component: VolunteeringRoute,
});
