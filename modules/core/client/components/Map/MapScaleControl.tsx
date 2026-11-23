// External dependencies
import { ScaleControl } from '@vis.gl/react-maplibre';
import React from 'react';

export default function MapScaleControl() {
  return <ScaleControl position="bottom-left" maxWidth={100} unit="metric" />;
}
