import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useAnalytics } from '@trustroots/analytics/client';
import { cn } from '@trustroots/ui/cn';

import LoadingIndicator from '../LoadingIndicator';
import { isWebGLSupported } from '../../utils/map';
import type { MapProps } from './types';

const MapLibreMap = lazy(() => import('./MapLibreMap'));
// Leaflet downloads only for browsers without WebGL2.
const LeafletMap = lazy(() => import('./LeafletMap'));

export default function Map(props: MapProps) {
  const [webGL] = useState(isWebGLSupported);
  const { track } = useAnalytics();
  useEffect(() => {
    if (!webGL) track('map_raster_fallback');
  }, [webGL]);

  const Renderer = webGL ? MapLibreMap : LeafletMap;
  return (
    <Suspense
      fallback={
        <div
          className={cn(props.className, 'tw:overflow-hidden')}
          style={props.style}
        >
          <LoadingIndicator />
        </div>
      }
    >
      <Renderer {...props} />
    </Suspense>
  );
}
