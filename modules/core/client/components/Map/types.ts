import type { CSSProperties, ReactNode, Ref } from 'react';

/** Zoom follows MapLibre's 512-pixel tiles in both renderers. */
export interface MapView {
  latitude: number;
  longitude: number;
  zoom: number;
}

export interface MapBounds {
  northEast: { lat: number; lng: number };
  southWest: { lat: number; lng: number };
}

export interface MapPoint {
  id: number;
  latitude: number;
  longitude: number;
  colour: string;
  properties: Record<string, unknown>;
}

/** Points that cluster below `clusterMaxZoom`, such as offers on the search map. */
export interface MapPointLayer {
  id: string;
  points: MapPoint[];
  minZoom: number;
  clusterMaxZoom: number;
  clusterMinPoints?: number;
  clusterColour: string;
  clusterTextColour: string;
}

export interface MapCluster {
  latitude: number;
  longitude: number;
  expansionZoom(): Promise<number>;
  leaves(): Promise<MapPoint[]>;
}

/** React content pinned to a location, such as a marker button or a popup. */
export interface MapPin {
  key: string;
  latitude: number;
  longitude: number;
  children: ReactNode;
}

export interface MapHandle {
  fitBounds(
    bounds: MapBounds,
    options: { padding: number; maxZoom?: number; animate?: boolean },
  ): void;
  flyTo(view: MapView, animate?: boolean): void;
  setPointState(
    layerId: string,
    pointId: number,
    state: { selected?: boolean; viewed?: boolean },
  ): void;
}

export interface MapProps {
  ref?: Ref<MapHandle>;
  /** The map moves to a new view object; keep the same object to stay put. */
  view: MapView;
  onLoad?: (view: MapView, bounds: MapBounds) => void;
  onMoveStart?: () => void;
  onMove?: (view: MapView, bounds: MapBounds) => void;
  onMoveEnd?: (view: MapView, bounds: MapBounds, dragged: boolean) => void;
  /** A click on the map itself rather than on a point, cluster or pin. */
  onClick?: (location: [number, number]) => void;
  layers?: MapPointLayer[];
  onPointClick?: (layerId: string, point: MapPoint) => void;
  onClusterClick?: (layerId: string, cluster: MapCluster) => void;
  pins?: MapPin[];
  popup?: MapPin | null;
  /** An approximate location: a 1 km circle from zoom 11, a dot below it. */
  area?: { latitude: number; longitude: number; colour: string } | null;
  scrollZoom?: boolean;
  minZoom?: number;
  worldBounds?: boolean;
  className?: string;
  style?: CSSProperties;
  'aria-hidden'?: boolean;
  children?: ReactNode;
}

export const MIN_AREA_CIRCLE_ZOOM = 11;
export const AREA_RADIUS_METRES = 1000;
