import { createFileRoute } from '@tanstack/react-router';
import React, { useEffect } from 'react';
import { useAuth } from '@/modules/core/client/react-app/auth';
import Safety from '@/modules/pages/client/components/Safety.component';
import { recordSafetyPageVisit } from '@/modules/users/client/api/users.api';

function SafetyPage() {
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

export const Route = createFileRoute('/safety')({
  staticData: { title: 'Safety' },
  component: SafetyPage,
});
