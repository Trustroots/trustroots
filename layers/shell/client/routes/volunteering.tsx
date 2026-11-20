import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import Volunteering from '@/modules/pages/client/components/Volunteering.component';
import TopicChat from '@/modules/tribes/client/components/TopicChat';
import { useAuth } from '@/modules/core/client/react-app/auth';

function VolunteeringRoute() {
  const { user } = useAuth();
  const member =
    user?._id && user.username
      ? {
          _id: user._id,
          username: user.username,
          nostrNpub:
            typeof user.nostrNpub === 'string' ? user.nostrNpub : undefined,
        }
      : undefined;

  return (
    <Volunteering>
      <TopicChat
        key={member ? `${member._id}:${member.nostrNpub || ''}` : 'visitor'}
        roomName="volunteering"
        user={member}
      />
    </Volunteering>
  );
}

export const Route = createFileRoute('/volunteering')({
  staticData: { title: 'Volunteering' },
  component: VolunteeringRoute,
});
