import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import ExperienceChangePage from '@/modules/experiences/client/components/ExperienceChangePage';
import { routeOptions, type RouteContext } from '../route-options';

function renderExperienceChange({ params }: RouteContext) {
  return <ExperienceChangePage id={params.id} />;
}

export const Route = createFileRoute('/experiences/$id/change')(
  routeOptions('/experiences/:id/change', renderExperienceChange),
);
