import React from 'react';

import type { RouteRender } from '@/modules/core/client/react-app/route-render';
import ExperienceChangePage from '@/modules/experiences/client/components/ExperienceChangePage';

export const experiencesRoutes: Record<string, RouteRender> = {
  '/experiences/:id/change': ({ params }) => (
    <ExperienceChangePage id={params.id} />
  ),
};
