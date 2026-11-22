import { createFileRoute, useParams } from '@tanstack/react-router';
import React from 'react';
import ExperienceChangePage from '@/modules/experiences/client/components/ExperienceChangePage';
import { requireAuth } from '../route-options';

function ExperienceChangeRoute() {
  const { id } = useParams({ from: '/experiences/$id/change' });
  return <ExperienceChangePage id={id} />;
}

export const Route = createFileRoute('/experiences/$id/change')({
  staticData: { title: 'Change an Experience' },
  beforeLoad: requireAuth,
  component: ExperienceChangeRoute,
});
