import React, { useEffect } from 'react';
import { useAuth } from '@/modules/core/client/react-app/auth';
import Safety from './components/Safety.component';
import { recordSafetyPageVisit } from '@/modules/users/client/api/users.api';
import Volunteering from './components/Volunteering.component';
import TopicChat from '@/modules/tribes/client/components/TopicChat';

export function SafetyPage() {
  const { user } = useAuth();
  const memberId = user?._id;

  useEffect(() => {
    if (memberId) {
      void recordSafetyPageVisit().catch(() => {
        // Keep the guidance available if the visit cannot be recorded.
      });
    }
  }, [memberId]);

  return <Safety />;
}

export function VolunteeringRoute() {
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
