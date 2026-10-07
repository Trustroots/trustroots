// External dependencies
import { useDebouncedCallback } from 'use-debounce';
import React, { createRef, useEffect, useRef, useState } from 'react';
import ReactMapGL, {
  FlyToInterpolator,
  Layer,
  Source,
  WebMercatorViewport,
} from 'react-map-gl';
import type { Event as NostrEvent } from 'nostr-tools';
import type { Map as MapboxMap, MapboxGeoJSONFeature } from 'mapbox-gl';
import type { SearchFilters } from '../utils/search-filters';
import type { SearchResultOffer } from './SearchSidebarResults.component';

// Internal dependencies
import {
  getMapBoxToken,
  isWebGLSupported,
} from '@/modules/core/client/utils/map';
import {
  MAP_STYLE_DEFAULT,
  MAP_STYLE_OSM,
} from '@/modules/core/client/components/Map/constants';
import { CLUSTER_MAX_ZOOM, MIN_ZOOM, SOURCE_OFFERS } from './constants';
import { DEFAULT_LOCATION } from '@/modules/core/client/utils/constants';
import MapNavigationControl from '@/modules/core/client/components/Map/MapNavigationControl';
import MapScaleControl from '@/modules/core/client/components/Map/MapScaleControl';
import MapStyleControl from '@/modules/core/client/components/Map/MapStyleControl';
import WheelMapController from '@/modules/core/client/components/Map/WheelMapController';
import SearchMapNoContent from './SearchMapNoContent';
import LeafletSearchMap from './LeafletSearchMap';
import { ensureValidLat, ensureValidLng } from '../utils';
import {
  clusterCountLayerMapbox,
  clusterCountLayerOSM,
  clusterLayer,
  unclusteredPointLayer,
} from './layers';
import { getOffer, queryOffers } from '@/modules/offers/client/api/offers.api';
import usePersistentMapStyle from '../hooks/use-persistent-map-style';
import usePersistentMapLocation from '../hooks/use-persistent-map-location';
import {
  getNostrEventAuthorPubkey,
  nostrService,
} from '../services/nostr.client.service';
import {
  SOURCE_COMMUNITY_NOTES,
  communityNotesLayer,
  communityNotesClusterLayer,
  communityNotesClusterCountLayer,
  communityNotesClusterCountLayerOSM,
} from './community-notes-layers';
import { OpenLocationCode } from 'open-location-code';
import 'mapbox-gl/dist/mapbox-gl.css';

declare const process: { env: { NODE_ENV?: string } };

interface MapBounds {
  northEast: { lat: number; lng: number };
  southWest: { lat: number; lng: number };
}

interface MapLocation {
  lat: number;
  lng: number;
  zoom?: number;
}

interface SearchMapProps {
  filters: string;
  isUserPublic: boolean;
  location?: Partial<MapLocation> | null;
  locationBounds?: Partial<MapBounds> | null;
  onOfferClose: () => void;
  onOfferOpen: (offer: SearchResultOffer) => void;
  onVisibleOffersChange?: (offerIds: string[]) => void;
  onVisibleCommunityNoteThreadsChange?: (
    threads: { notes: NostrEvent[]; plusCode: string | null }[],
  ) => void;
  onCommunityNoteOpen: (note: {
    notes: NostrEvent[];
    plusCode: string | null;
  }) => void;
}

interface MapViewport {
  latitude: number;
  longitude: number;
  zoom: number;
  transitionDuration?: number | 'auto';
  transitionInterpolator?: InstanceType<typeof FlyToInterpolator>;
}

type MapFeature = MapboxGeoJSONFeature & {
  id: string | number;
  properties: Record<string, unknown>;
  geometry: { type: 'Point'; coordinates: [number, number] };
};

interface MapMouseEvent {
  features?: MapFeature[];
}

interface OfferFeatureProperties {
  id: string;
  content: string;
  pubkey: string;
  authorPubkey?: string;
  created_at: number;
  kind: number;
  sig: string;
  tags: string | string[][];
  [key: string]: unknown;
}

type CommunityNoteFeature = NostrEvent & {
  authorPubkey?: string;
  [key: string]: unknown;
};

interface GeoJSONPointFeature {
  type: 'Feature';
  id: string;
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: OfferFeatureProperties;
}

interface FeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONPointFeature[];
}

interface MapState {
  zoom?: number;
  bounds?: {
    northEast: { lat: number; lng: number };
    southWest: { lat: number; lng: number };
  };
  latitude: number;
  longitude: number;
}

interface SearchMapLayerProps {
  id: string;
  type: string;
  source: string;
  filter?: unknown[];
  minzoom?: number;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
}

const COMMUNITY_NOTES_RECONNECT_DELAY_MS = 1000;
const MISSING_MAP_LAYER_ERROR =
  /^The layer '.*' does not exist in the map's style and cannot be queried for features\.$/;

type MapCorner = { lat: number; lng: number };

function isLongitudeVisible(longitude: number, west: number, east: number) {
  let span = east - west;
  if (span < 0) span += 360;
  if (span >= 360) return true;

  const relativeLongitude = (((longitude - west) % 360) + 360) % 360;
  return relativeLongitude <= span;
}

function normalizeBoundsCorners(mapBounds: {
  getNorthEast?: () => MapCorner;
  getSouthWest?: () => MapCorner;
  northEast?: MapCorner;
  southWest?: MapCorner;
}): { northEast?: MapCorner; southWest?: MapCorner } {
  return {
    northEast: mapBounds.getNorthEast?.() ?? mapBounds.northEast,
    southWest: mapBounds.getSouthWest?.() ?? mapBounds.southWest,
  };
}

function isCoordinateInViewport(
  longitude: number,
  latitude: number,
  southWest: MapCorner,
  northEast: MapCorner,
) {
  return (
    latitude >= southWest.lat &&
    latitude <= northEast.lat &&
    isLongitudeVisible(longitude, southWest.lng, northEast.lng)
  );
}

const olc = new OpenLocationCode();
const ignoreVisibleCallback = () => {};
const TypedLayer = Layer as unknown as React.ComponentType<SearchMapLayerProps>;
const TypedSource = Source as unknown as React.ComponentType<
  React.ComponentProps<typeof Source> & {
    clusterMinPoints?: number;
    ref?: React.Ref<unknown>;
  }
>;
const TypedReactMapGL = ReactMapGL as unknown as React.ComponentType<
  React.ComponentProps<typeof ReactMapGL> & { location?: [number, number] }
>;

function handleMapError(event: unknown) {
  const error =
    event && typeof event === 'object' && 'error' in event
      ? event.error
      : undefined;
  const errorMessage = error instanceof Error ? error.message : '';

  // A pointer event can race with style teardown after React has removed the
  // interactive layers. Mapbox already returns no features for this query, so
  // do not report the expected lifecycle race as an application error.
  if (MISSING_MAP_LAYER_ERROR.test(errorMessage)) {
    return;
  }

  // Keep Mapbox's default behaviour for every other map error.
  // eslint-disable-next-line no-console
  console.error(error || event);
}

function getPlusCodeFromRawEvent(event: NostrEvent): string | null {
  const tag = event.tags.find(
    t => t[0] === 'l' && t.length >= 3 && t[2] === 'open-location-code',
  );
  return tag ? tag[1] : null;
}

function getPlusCodeFromEvent(
  properties: OfferFeatureProperties,
): string | null {
  const tags: string[][] =
    typeof properties.tags === 'string'
      ? JSON.parse(properties.tags)
      : properties.tags;
  const tag = tags.find(
    t => t[0] === 'l' && t.length >= 3 && t[2] === 'open-location-code',
  );
  return tag ? tag[1] : null;
}

function reconstructEvent(
  properties: OfferFeatureProperties,
): CommunityNoteFeature {
  return {
    id: properties.id,
    content: properties.content,
    pubkey: properties.pubkey,
    authorPubkey: properties.authorPubkey,
    created_at: properties.created_at,
    kind: properties.kind,
    sig: properties.sig,
    tags:
      typeof properties.tags === 'string'
        ? JSON.parse(properties.tags)
        : properties.tags,
  };
}

function nostrEventsToGeoJSON(
  events: CommunityNoteFeature[],
): FeatureCollection {
  const features: GeoJSONPointFeature[] = events.flatMap(event => {
    const plusCodeTag = event.tags.find(
      t => t[0] === 'l' && t.length >= 3 && t[2] === 'open-location-code',
    );
    if (!plusCodeTag) {
      return [];
    }
    const code = plusCodeTag[1];
    let area;
    try {
      area = olc.decode(code);
    } catch {
      return [];
    }
    return [
      {
        type: 'Feature' as const,
        id: event.id,
        geometry: {
          type: 'Point' as const,
          coordinates: [area.longitudeCenter, area.latitudeCenter] as [
            number,
            number,
          ],
        },
        properties: {
          id: event.id,
          content: event.content,
          pubkey: event.pubkey,
          authorPubkey: getNostrEventAuthorPubkey(event),
          created_at: event.created_at,
          kind: event.kind,
          sig: event.sig,
          tags: JSON.stringify(event.tags),
        },
      },
    ];
  });
  return { type: 'FeatureCollection', features };
}

export default function SearchMap({
  filters,
  isUserPublic,
  location,
  locationBounds: bounds,
  onOfferClose,
  onOfferOpen,
  onVisibleOffersChange = ignoreVisibleCallback,
  onVisibleCommunityNoteThreadsChange = ignoreVisibleCallback,
  onCommunityNoteOpen,
}: SearchMapProps) {
  /**
   * Store map location in browser cache
   */
  const [persistentMapLocation, setPersistentMapLocation] =
    usePersistentMapLocation({
      latitude: DEFAULT_LOCATION.lat,
      longitude: DEFAULT_LOCATION.lng,
      zoom: DEFAULT_LOCATION.zoom,
    });

  /**
   * Debounce setting persistent map state to avoid performance issues
   */
  const debouncedSetPersistentMapLocation = useDebouncedCallback(
    setPersistentMapLocation,
    // delay in ms
    1000,
    // The maximum time func is allowed to be delayed before it's invoked:
    { maxWait: 3000 },
  );

  const [viewport, setViewport] = useState<MapViewport>(persistentMapLocation);
  const viewportRef = useRef<MapViewport>(persistentMapLocation);
  const gestureSurfaceRef = useRef<HTMLDivElement | null>(null);
  const viewportChangeRef = useRef<((next: MapViewport) => void) | null>(null);
  const [webGLSupported] = useState(isWebGLSupported);
  const [mapController] = useState(() => new WheelMapController());
  const [mapStyle, setMapstyle] = usePersistentMapStyle(MAP_STYLE_DEFAULT);
  const [map, setMap] = useState<MapboxMap | undefined>();
  const [hoveredOffer, setHoveredOffer] = useState<MapFeature | false>(false);
  const [selectedOffer, setSelectedOffer] = useState<MapFeature | false>(false);
  const [offers, setOffers] = useState<FeatureCollection>({
    features: [],
    type: 'FeatureCollection',
  });
  const offersRequestRef = useRef(0);
  const [communityNotes, setCommunityNotes] = useState<FeatureCollection>({
    type: 'FeatureCollection',
    features: [],
  });
  const [leafletMapState, setLeafletMapState] = useState<
    MapState | undefined
  >();
  const communityNotesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const communityNotesEventsRef = useRef<CommunityNoteFeature[]>([]);
  const hasInitialisedFiltersRef = useRef(false);

  const parsedFilters: Partial<SearchFilters> = filters
    ? JSON.parse(filters)
    : {};
  const communityNotesEnabled = parsedFilters.communityNotes || false;
  const MAPBOX_TOKEN = getMapBoxToken();
  // A Mapbox style can be persisted in localStorage from a session that had a
  // token configured. Without a token, mapbox-gl can't load it and the map
  // renders blank, so fall back to the tokenless OSM style.
  const isMapboxStyle =
    typeof mapStyle === 'string' && mapStyle.startsWith('mapbox://');
  const effectiveMapStyle =
    !MAPBOX_TOKEN && isMapboxStyle ? MAP_STYLE_OSM : mapStyle;
  const isOsmStyle =
    typeof effectiveMapStyle !== 'string' &&
    effectiveMapStyle?.name === MAP_STYLE_OSM.name;
  // If no mapbox token, and we're in production, don't show the style switcher
  const showMapStyles =
    webGLSupported && (!!MAPBOX_TOKEN || process.env.NODE_ENV !== 'production');
  const sourceRef = createRef<React.ComponentRef<typeof Source>>();
  const mapRef = createRef<React.ComponentRef<typeof ReactMapGL>>();

  // Get the Mapbox object for direct map manipulation
  const getMapRef = () => map || mapRef?.current?.getMap();

  /**
   * Zoom visible map to bounding box
   *
   * @param  {object} bounds Bounding box coordinates with shape:
   *   northEast.lat;
   *   northEast.lng;
   *   southWest.lat;
   *   southWest.lng;
   */
  const zoomToBounds = ({ northEast, southWest }: MapBounds) => {
    const newViewport = new WebMercatorViewport(
      viewport as ConstructorParameters<typeof WebMercatorViewport>[0],
    );
    const { longitude, latitude, zoom } = newViewport.fitBounds(
      [
        // [minLng, minLat],
        // [maxLng, maxLat],
        [northEast.lng, northEast.lat],
        [southWest.lng, southWest.lat],
      ],
      {
        padding: 40,
      },
    );

    setViewport({
      ...viewport,
      longitude,
      latitude,
      zoom,
    });
  };

  /**
   * Hook on map interactions to update features
   */
  const updateOffers = (leafletState?: MapState) => {
    // Don't fetch if viewing the whole world
    const zoom = leafletState?.zoom || viewport.zoom;
    if (zoom <= MIN_ZOOM) {
      return;
    }

    const map = getMapRef();

    const mapBounds = leafletState?.bounds || map?.getBounds();
    if (!mapBounds) {
      return;
    }

    // https://docs.mapbox.com/mapbox-gl-js/api/geography/#lnglatbounds
    const { northEast, southWest } = normalizeBoundsCorners(mapBounds);
    if (!northEast || !southWest) {
      return;
    }

    // Expand bounding box depending on the zoom level slightly to load more offers over the edge of the viewport
    const boundsBuffer = 10 / zoom;
    // Latitudes must be between -90 and 90
    // Longitudes must be between -180 and 180
    const northEastLat = ensureValidLat(northEast.lat + boundsBuffer);
    const northEastLng = ensureValidLng(northEast.lng + boundsBuffer);
    const southWestLat = ensureValidLat(southWest.lat - boundsBuffer);
    const southWestLng = ensureValidLng(southWest.lng - boundsBuffer);

    // @TODO: no need to fetch if in same area as in previous fetch — thus store in state?
    fetchOffers({
      northEastLat,
      northEastLng,
      southWestLat,
      southWestLng,
    });
  };

  /**
   * Refresh persistent map state when viewport changes
   */
  const onViewPortChange = (viewport: MapViewport) => {
    viewportRef.current = viewport;
    setViewport(viewport);

    const { latitude, longitude, zoom } = viewport;
    debouncedSetPersistentMapLocation({ latitude, longitude, zoom });
  };
  viewportChangeRef.current = onViewPortChange;

  useEffect(() => {
    const surface = gestureSurfaceRef.current;

    if (!webGLSupported || !surface) {
      return undefined;
    }

    const handlePinchWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) {
        return;
      }

      // Firefox sends desktop trackpad pinches as Ctrl+wheel. Capture them
      // before the map's wheel handler and the browser's page zoom handler.
      event.preventDefault();
      event.stopPropagation();

      const current = viewportRef.current;
      const deltaY = event.deltaMode === 1 ? event.deltaY * 40 : event.deltaY;
      const zoom = Math.max(0, Math.min(20, current.zoom - deltaY * 0.01));

      if (zoom !== current.zoom) {
        viewportChangeRef.current?.({ ...current, zoom });
      }
    };

    surface.addEventListener('wheel', handlePinchWheel, {
      capture: true,
      passive: false,
    });

    return () => surface.removeEventListener('wheel', handlePinchWheel, true);
  }, [webGLSupported]);

  /**
   * Debounce getting fresh offers for new map state to avoid performance issues
   */
  const debouncedUpdateOffers = useDebouncedCallback(
    updateOffers,
    // delay in ms
    500,
    // The maximum time func is allowed to be delayed before it's invoked:
    { maxWait: 3500 },
  );

  const onLeafletMapChange = (mapState: MapState) => {
    setLeafletMapState(mapState);
    onViewPortChange(mapState as MapViewport);
    debouncedUpdateOffers(mapState);
  };

  /**
   * Update state for a feature on the map
   */
  const updateFeatureState = (
    feature: MapFeature,
    newState: Record<string, boolean>,
  ) => {
    const map = getMapRef();
    const { source, id } = feature;
    const previousState = map.getFeatureState({
      source,
      id,
    });

    map.setFeatureState(
      { source, id },
      {
        ...previousState,
        // New state merges into previous state, overriding only defined keys
        ...newState,
      },
    );
  };

  /**
   * Reset hover state for previouslyly hovered feature
   */
  const clearPreviouslyHoveredState = () => {
    if (hoveredOffer) {
      setHoveredOffer(false);
      updateFeatureState(hoveredOffer, { hover: false });
    }
  };

  /**
   * Reset selected state for previouslyly selected feature
   */
  const clearPreviouslySelectedState = () => {
    if (selectedOffer) {
      updateFeatureState(selectedOffer, { selected: false });
      setSelectedOffer(false);
    }
  };

  /**
   * Set selected state for a feature
   */
  const setSelectedState = (offer: MapFeature) => {
    // Clear out previously selected offers
    if (selectedOffer) {
      updateFeatureState(selectedOffer, { selected: false });
    }

    // Mark newly selected offer
    updateFeatureState(offer, { selected: true, viewed: true });
    setSelectedOffer(offer);
  };

  /**
   * Handle feature hover states on map
   */
  const onHover = (event: MapMouseEvent) => {
    if (!event?.features?.length) {
      return;
    }

    const feature = event.features[0];

    // Stop here if:
    // - feature on other than points layer, or
    // - feature doesn't have ID for some reason, or
    // - we're just hovering previously hovered feature
    if (
      (feature.layer.id !== unclusteredPointLayer.id &&
        feature.layer.id !== communityNotesLayer.id) ||
      !feature.id ||
      (hoveredOffer && feature.id === hoveredOffer.id)
    ) {
      return;
    }

    clearPreviouslyHoveredState();
    setHoveredOffer(feature);
    updateFeatureState(feature, { hover: true });
  };

  /**
   * Zoom to cluster of features
   * @link https://github.com/visgl/react-map-gl/blob/5.2-release/examples/zoom-to-bounds/src/app.js
   */
  const zoomToCluster = (cluster: MapFeature) => {
    const clusterId = cluster?.properties?.cluster_id;

    if (typeof clusterId !== 'number') {
      return;
    }

    const newLocation = {
      latitude: cluster.geometry.coordinates[1],
      longitude: cluster.geometry.coordinates[0],
      transitionDuration: 'auto' as const,
      transitionInterpolator: new FlyToInterpolator({ speed: 3.0 }),
    };

    // react-map-gl v5's <Source> is a plain function component and does not
    // forward refs, so `sourceRef.current` is always null. Read the clustered
    // source straight from the live map instead.
    const source = getMapRef()?.getSource(SOURCE_OFFERS);

    if (!source) {
      // At least center the group if the source isn't ready yet.
      setViewport({
        ...viewport,
        ...newLocation,
      });

      return;
    }

    source.getClusterExpansionZoom(
      clusterId,
      (err: Error | null, zoom?: number) => {
        if (err || zoom === undefined) {
          return;
        }

        // Transition map to show offers in the cluster
        setViewport({
          ...viewport,
          ...newLocation,
          zoom: Math.min(zoom + 1, CLUSTER_MAX_ZOOM),
        });
      },
    );
  };

  /**
   * React on any clicks on map or layers defined on `interactiveLayerIds` prop
   */
  function openCommunityNote(feature: Pick<MapFeature, 'properties'>) {
    const clickedPlusCode = getPlusCodeFromEvent(
      feature.properties as unknown as OfferFeatureProperties,
    );

    // Find all notes sharing the same plus code (the "thread")
    const threadNotes = communityNotesEventsRef.current.filter(event => {
      const eventPlusCode = getPlusCodeFromRawEvent(event);
      return eventPlusCode && eventPlusCode === clickedPlusCode;
    });

    if (onCommunityNoteOpen) {
      onCommunityNoteOpen({
        notes:
          threadNotes.length > 0
            ? threadNotes
            : [
                reconstructEvent(
                  feature.properties as unknown as OfferFeatureProperties,
                ),
              ],
        plusCode: clickedPlusCode,
      });
    }
  }

  const zoomToCommunityNotesCluster = (cluster: MapFeature) => {
    if (!cluster?.geometry?.coordinates) {
      return;
    }

    setViewport({
      ...viewport,
      latitude: cluster.geometry.coordinates[1],
      longitude: cluster.geometry.coordinates[0],
      zoom: Math.min((viewport.zoom || 2) + 3, CLUSTER_MAX_ZOOM),
      transitionDuration: 'auto',
      transitionInterpolator: new FlyToInterpolator({ speed: 3.0 }),
    });
  };

  const openCommunityNotesCluster = (cluster: MapFeature) => {
    const clusterId = cluster?.properties?.cluster_id;
    if (typeof clusterId !== 'number') {
      zoomToCommunityNotesCluster(cluster);
      return;
    }

    const source = getMapRef()?.getSource(SOURCE_COMMUNITY_NOTES);
    if (!source) {
      zoomToCommunityNotesCluster(cluster);
      return;
    }

    source.getClusterLeaves(
      clusterId,
      Number(cluster.properties.point_count) || 0,
      0,
      (error: Error | null, leaves: MapFeature[]) => {
        if (error) {
          zoomToCommunityNotesCluster(cluster);
          return;
        }

        const plusCode = getPlusCodeFromEvent(
          leaves[0].properties as unknown as OfferFeatureProperties,
        );
        const sharesPlusCode = leaves.every(
          (leaf: MapFeature) =>
            getPlusCodeFromEvent(
              leaf.properties as unknown as OfferFeatureProperties,
            ) === plusCode,
        );

        if (!sharesPlusCode) {
          zoomToCommunityNotesCluster(cluster);
          return;
        }

        if (onCommunityNoteOpen) {
          onCommunityNoteOpen({
            notes: leaves.map(leaf =>
              reconstructEvent(
                leaf.properties as unknown as OfferFeatureProperties,
              ),
            ),
            plusCode,
          });
        }
      },
    );
  };

  const onClickMap = (event: MapMouseEvent) => {
    const { features } = event;
    clearPreviouslySelectedState();

    if (!features?.length) {
      // Close open offers when clicking on map canvas
      // Delegated to the search shell.
      onOfferClose();
      return;
    }

    // A point from any source should win over an overlapping cluster. The
    // returned features follow rendered layer order, so this keeps the
    // topmost individual offer or note while avoiding an unexpected cluster
    // expansion when another source's cluster covers the same location.
    const clickedFeature =
      features.find(
        feature =>
          feature.layer?.id === unclusteredPointLayer.id ||
          feature.layer?.id === communityNotesLayer.id,
      ) || features[0];
    const layerId = clickedFeature?.layer?.id;

    // Community notes click — open thread in sidebar
    if (layerId === communityNotesLayer.id) {
      openCommunityNote(clickedFeature);
      return;
    }

    // Community notes cluster click — zoom in
    if (layerId === communityNotesClusterLayer.id) {
      openCommunityNotesCluster(clickedFeature);
      return;
    }

    switch (layerId) {
      // Hosting or meeting offer
      case unclusteredPointLayer.id:
        if (clickedFeature?.id) {
          setSelectedState(clickedFeature);
          openOfferById(clickedFeature.id);
        }
        break;
      // Clusters
      case clusterLayer.id:
        zoomToCluster(clickedFeature);
        break;
    }
  };

  /**
   * Fetch offer data and open it in the search sidebar.
   */
  async function openOfferById(offerId: string | number) {
    // @TODO: cancellation when opening another offer instead
    const offer = await getOffer(String(offerId));

    if (offer) {
      // Delegated to the search shell.
      // The offer endpoint returns the sidebar profile fields at runtime.
      onOfferOpen(offer as unknown as SearchResultOffer);
    }
  }

  /**
   * Fetch offers inside bounding box
   */
  async function fetchOffers(boundingBox: Record<string, number>) {
    if (!isUserPublic) {
      return;
    }

    const requestId = ++offersRequestRef.current;
    try {
      // @TODO: cancellation when need to re-fetch
      const data = await queryOffers({
        filters,
        ...boundingBox,
      });
      if (requestId === offersRequestRef.current) {
        setOffers(data as unknown as FeatureCollection);
      }
    } catch {
      // @TODO Error handling
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('Could not load offers.');
      }
    }
  }

  // The search request has a small buffer so offers near the edge remain
  // available while panning. The Results pane lists only pins and
  // author-visible community notes inside the actual map viewport.
  useEffect(() => {
    const mapBounds = webGLSupported
      ? getMapRef()?.getBounds()
      : leafletMapState?.bounds;
    const { northEast, southWest } = mapBounds
      ? normalizeBoundsCorners(mapBounds)
      : {};
    const zoom = leafletMapState?.zoom ?? viewport.zoom;
    const hasViewport = Boolean(northEast && southWest) && zoom > MIN_ZOOM;

    if (!hasViewport) {
      onVisibleOffersChange([]);
      onVisibleCommunityNoteThreadsChange([]);
      return;
    }

    onVisibleOffersChange(
      offers.features
        .filter(feature => {
          const [longitude, latitude] = feature.geometry.coordinates;
          return isCoordinateInViewport(
            longitude,
            latitude,
            southWest!,
            northEast!,
          );
        })
        .map(feature => feature.properties.id),
    );

    if (!communityNotesEnabled) {
      onVisibleCommunityNoteThreadsChange([]);
      return;
    }

    const threads = new Map<
      string,
      { notes: NostrEvent[]; plusCode: string }
    >();

    communityNotes.features.forEach(feature => {
      const [longitude, latitude] = feature.geometry.coordinates;
      if (
        !isCoordinateInViewport(longitude, latitude, southWest!, northEast!)
      ) {
        return;
      }

      const properties = feature.properties as OfferFeatureProperties;
      const plusCode = getPlusCodeFromEvent(properties)!;
      const thread = threads.get(plusCode) || { notes: [], plusCode };
      thread.notes.push(reconstructEvent(properties));
      threads.set(plusCode, thread);
    });

    onVisibleCommunityNoteThreadsChange([...threads.values()]);
  }, [
    communityNotes,
    communityNotesEnabled,
    leafletMapState,
    map,
    offers,
    onVisibleCommunityNoteThreadsChange,
    onVisibleOffersChange,
    viewport,
    webGLSupported,
  ]);

  // Load and store Mapbox object for quick reference on render
  useEffect(() => {
    if (webGLSupported) {
      setMap(getMapRef());
    }
  }, []);

  // Apply externally changed bounds object
  // Changed by the search sidebar
  useEffect(() => {
    if (webGLSupported && bounds?.northEast && bounds?.southWest) {
      zoomToBounds(bounds as MapBounds);
    }
  }, [bounds, webGLSupported]);

  // Apply externally changed filters object
  // Changed by the search sidebar
  useEffect(() => {
    // Preserve an offer opened from the initial URL. Later filter changes
    // clear the selection because it may no longer match the visible results.
    if (hasInitialisedFiltersRef.current) {
      onOfferClose();
    } else {
      hasInitialisedFiltersRef.current = true;
    }
    clearPreviouslySelectedState();
    clearPreviouslyHoveredState();

    // Update map offers
    setOffers({ features: [], type: 'FeatureCollection' });
    updateOffers(webGLSupported ? undefined : leafletMapState);
  }, [filters]);

  // Subscribe/unsubscribe to community notes based on toggle
  useEffect(() => {
    if (!communityNotesEnabled) {
      setCommunityNotes({ type: 'FeatureCollection', features: [] });
      return;
    }

    communityNotesEventsRef.current = [];
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const updateCommunityNotes = async () => {
      const events = [...communityNotesEventsRef.current];
      const visibleNotes =
        (await nostrService.filterCommunityNotesByAuthorVisibility(
          events,
        )) as CommunityNoteFeature[];

      if (
        cancelled ||
        events.length !== communityNotesEventsRef.current.length
      ) {
        return;
      }
      setCommunityNotes(nostrEventsToGeoJSON(visibleNotes));
    };

    const receiveCommunityNote = (event: NostrEvent) => {
      const note = {
        ...event,
        authorPubkey: getNostrEventAuthorPubkey(event),
      };
      const existingIndex = communityNotesEventsRef.current.findIndex(
        existing => existing.id === event.id,
      );
      if (existingIndex === -1) {
        communityNotesEventsRef.current.push(note);
      } else {
        communityNotesEventsRef.current[existingIndex] = note;
      }
      if (communityNotesTimerRef.current !== null) {
        clearTimeout(communityNotesTimerRef.current);
      }
      communityNotesTimerRef.current = setTimeout(() => {
        void updateCommunityNotes();
      }, 200);
    };

    const handleEose = () => {
      if (communityNotesTimerRef.current !== null) {
        clearTimeout(communityNotesTimerRef.current);
      }
      void updateCommunityNotes();
    };

    const scheduleReconnect = () => {
      if (cancelled || reconnectTimer) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        // Defined below before any reconnect timer can run.
        // eslint-disable-next-line no-use-before-define
        void subscribeToCommunityNotes();
      }, COMMUNITY_NOTES_RECONNECT_DELAY_MS);
    };

    const subscribeToCommunityNotes = async () => {
      try {
        await nostrService.subscribeMapNotes(receiveCommunityNote, undefined, {
          onClose: scheduleReconnect,
          onEose: handleEose,
        });
      } catch {
        scheduleReconnect();
      }
    };

    void subscribeToCommunityNotes();

    return () => {
      cancelled = true;
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      nostrService.unsubscribeMapNotes();
      if (communityNotesTimerRef.current !== null) {
        clearTimeout(communityNotesTimerRef.current);
      }
    };
  }, [communityNotesEnabled]);

  // Apply externally changed location object
  // Changed by the search shell when loading an offer via the URL
  useEffect(() => {
    if (location?.lat && location?.lng) {
      setViewport({
        ...viewport,
        latitude: location.lat,
        longitude: location.lng,
        zoom: location?.zoom || DEFAULT_LOCATION.zoom,
      });
    }
  }, [location]);

  if (!webGLSupported) {
    return (
      <LeafletSearchMap
        bounds={
          bounds?.northEast && bounds?.southWest ? (bounds as MapBounds) : null
        }
        communityNotes={communityNotes}
        offers={offers}
        onCommunityNoteClick={openCommunityNote}
        onMapChange={onLeafletMapChange}
        onMapClick={onOfferClose}
        onOfferClick={openOfferById}
        viewport={viewport}
      />
    );
  }

  return (
    <div data-map-zoom={viewport.zoom} ref={gestureSurfaceRef}>
      <TypedReactMapGL
        reuseMaps
        controller={mapController}
        className="search-map"
        dragRotate={false}
        /*
         * Pointer event callbacks will only query the features under the pointer
         * of `interactiveLayerIds` layers. The getCursor callback will receive
         * `isHovering:true` when hover over features of these layers.
         *
         * https://visgl.github.io/react-map-gl/docs/api-reference/interactive-map#interactivelayerids
         */
        interactiveLayerIds={[
          clusterLayer.id,
          unclusteredPointLayer.id,
          ...(communityNotesEnabled
            ? [communityNotesLayer.id, communityNotesClusterLayer.id]
            : []),
        ]}
        location={[
          persistentMapLocation?.latitude ?? DEFAULT_LOCATION.lat,
          persistentMapLocation?.longitude ?? DEFAULT_LOCATION.lng,
        ]}
        mapboxApiAccessToken={MAPBOX_TOKEN || undefined}
        mapStyle={effectiveMapStyle}
        onClick={onClickMap}
        onError={event => handleMapError(event)}
        onHover={onHover}
        onInteractionStateChange={debouncedUpdateOffers}
        onMouseLeave={clearPreviouslyHoveredState}
        onViewportChange={onViewPortChange}
        ref={mapRef}
        touchRotate={false}
        {...viewport}
        /* Keep viewport pixel dimensions from overriding responsive sizing. */
        height="100%"
        width="100%"
      >
        {viewport.zoom <= MIN_ZOOM && <SearchMapNoContent />}
        <MapScaleControl />
        <MapNavigationControl />
        {showMapStyles && (
          <MapStyleControl
            mapStyle={effectiveMapStyle}
            setMapstyle={setMapstyle}
          />
        )}
        <TypedSource
          buffer={512}
          cluster
          clusterMaxZoom={CLUSTER_MAX_ZOOM}
          clusterMinPoints={3}
          clusterRadius={50}
          data={offers as unknown as GeoJSON.FeatureCollection}
          id={SOURCE_OFFERS}
          promoteId="id" // Use feature.properties.id as feature ID; used e.g. for hover effect with `setFeatureState()`
          ref={sourceRef}
          type="geojson"
        >
          <TypedLayer {...clusterLayer} />
          {/* OSM and Mapbox use different fonts for cluster numbers */}
          {isOsmStyle ? (
            <TypedLayer {...clusterCountLayerOSM} />
          ) : (
            <TypedLayer {...clusterCountLayerMapbox} />
          )}
          <TypedLayer {...unclusteredPointLayer} />
        </TypedSource>
        {communityNotesEnabled && (
          <TypedSource
            id={SOURCE_COMMUNITY_NOTES}
            type="geojson"
            data={communityNotes as unknown as GeoJSON.FeatureCollection}
            cluster
            clusterMaxZoom={14}
            clusterRadius={50}
            promoteId="id"
          >
            <TypedLayer {...communityNotesClusterLayer} />
            {isOsmStyle ? (
              <TypedLayer {...communityNotesClusterCountLayerOSM} />
            ) : (
              <TypedLayer {...communityNotesClusterCountLayer} />
            )}
            <TypedLayer {...communityNotesLayer} />
          </TypedSource>
        )}
      </TypedReactMapGL>
    </div>
  );
}
