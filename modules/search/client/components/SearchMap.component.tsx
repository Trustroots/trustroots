// External dependencies
import useDebouncedCallback from '@/modules/core/client/hooks/use-debounced-callback';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Event as NostrEvent } from 'nostr-tools';
import {
  countNarrowingFilters,
  type SearchFilters,
} from '../utils/search-filters';
import type { SearchResultOffer } from './SearchSidebarResults.component';
import type { OfferSearchFeatureCollection } from '@/modules/offers/shared/offer';

// Internal dependencies
import Map from '@/modules/core/client/components/Map/index';
import type {
  MapBounds,
  MapCluster,
  MapHandle,
  MapPoint,
} from '@/modules/core/client/components/Map/types';
import {
  CLUSTER_MAX_ZOOM,
  MIN_ZOOM,
  SOURCE_COMMUNITY_NOTES,
  SOURCE_OFFERS,
} from './constants';
import { DEFAULT_LOCATION } from '@/modules/core/client/utils/constants';
import useMapDefaultLocation, {
  type MapDefaultLocation,
} from '@/modules/core/client/utils/use-map-default-location';
import MapDefaultAttribution from '@/modules/core/client/components/Map/MapDefaultAttribution';
import DeviceLocationButton from '@/modules/core/client/components/DeviceLocationButton';
import type { DeviceLocation } from '@/modules/core/client/utils/use-device-location';
import { useAnalytics } from '@trustroots/analytics/client';
import SearchMapNoContent from './SearchMapNoContent';
import { ensureValidLat, ensureValidLng } from '../utils';
import { featureId } from '../utils/feature-id';
import { getOffer, queryOffers } from '@/modules/offers/client/api/offers.api';
import usePersistentMapLocation from '../hooks/use-persistent-map-location';
import {
  getNostrEventAuthorPubkey,
  nostrService,
} from '../services/nostr.client.service';
import { OpenLocationCode } from 'open-location-code';

declare const process: { env: { NODE_ENV?: string } };

interface MapLocation {
  lat: number;
  lng: number;
  zoom?: number;
  clearSelection?: boolean;
}

export interface VisibleMapCounts {
  host?: number;
  meet?: number;
  communityNotes?: number;
}

interface SearchMapProps {
  filters: string;
  isUserPublic: boolean;
  location?: Partial<MapLocation> | null;
  locationBounds?: Partial<MapBounds> | null;
  onOfferClose: () => void;
  onOfferOpen: (offer: SearchResultOffer) => void;
  onVisibleOffersChange?: (offerIds: string[]) => void;
  onVisibleMapCountsChange?: (counts: VisibleMapCounts) => void;
  onVisibleCommunityNoteThreadsChange?: (
    threads: { notes: NostrEvent[]; plusCode: string | null }[],
  ) => void;
  onCommunityNoteOpen: (note: {
    notes: NostrEvent[];
    plusCode: string | null;
  }) => void;
  onDeviceLocationRequest?: () => void;
  onDeviceLocation?: (location: DeviceLocation) => void;
  onApproximateLocation?: (location: MapDefaultLocation) => void;
}

interface MapViewport {
  latitude: number;
  longitude: number;
  zoom: number;
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
  id: number;
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: OfferFeatureProperties;
}

interface FeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONPointFeature[];
}

const COMMUNITY_NOTES_RECONNECT_DELAY_MS = 1000;
const OFFER_COLOURS: Record<string, string> = {
  'meet-yes': '#11b4da',
  'host-yes': '#58ba58',
  'host-maybe': '#f2ae43',
};
const COMMUNITY_NOTE_COLOUR = '#1565C0';

type MapCorner = { lat: number; lng: number };

function isLongitudeVisible(longitude: number, west: number, east: number) {
  let span = east - west;
  if (span < 0) span += 360;
  if (span >= 360) return true;

  const relativeLongitude = (((longitude - west) % 360) + 360) % 360;
  return relativeLongitude <= span;
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
        id: featureId(event.id),
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
  onVisibleMapCountsChange = ignoreVisibleCallback,
  onVisibleCommunityNoteThreadsChange = ignoreVisibleCallback,
  onCommunityNoteOpen,
  onDeviceLocationRequest,
  onDeviceLocation,
  onApproximateLocation,
}: SearchMapProps) {
  /**
   * Store map location in browser cache
   */
  const [persistentMapLocation, setPersistentMapLocation, hasSavedLocation] =
    usePersistentMapLocation({
      latitude: DEFAULT_LOCATION.lat,
      longitude: DEFAULT_LOCATION.lng,
      zoom: DEFAULT_LOCATION.zoom,
    });
  const hasDestination = Boolean(
    (location &&
      Number.isFinite(location.lat) &&
      Number.isFinite(location.lng)) ||
    (bounds?.northEast && bounds?.southWest),
  );
  const [approximateLocation, stopDefaultLocation] = useMapDefaultLocation(
    !hasDestination && !hasSavedLocation,
  );
  const interactionPending = useRef(false);
  const onInteraction = () => {
    interactionPending.current = true;
    stopDefaultLocation();
  };

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

  const [viewport, setViewport] = useState<MapViewport>(() => ({
    latitude: persistentMapLocation.latitude ?? DEFAULT_LOCATION.lat,
    longitude: persistentMapLocation.longitude ?? DEFAULT_LOCATION.lng,
    zoom: persistentMapLocation.zoom ?? DEFAULT_LOCATION.zoom,
  }));
  // The camera the map moves to; `viewport` follows what the map shows.
  const [targetView, setTargetView] = useState(viewport);
  const boundsRef = useRef<MapBounds | null>(null);
  const mapRef = useRef<MapHandle>(null);
  const [loaded, setLoaded] = useState(false);
  const hasAppliedApproximateLocation = useRef(false);
  useEffect(() => {
    if (
      approximateLocation &&
      !hasDestination &&
      !hasSavedLocation &&
      !hasAppliedApproximateLocation.current
    ) {
      hasAppliedApproximateLocation.current = true;
      setTargetView(approximateLocation);
      setViewport(approximateLocation);
    }
  }, [approximateLocation, hasDestination, hasSavedLocation]);
  const [selectedOffer, setSelectedOffer] = useState<MapPoint | false>(false);
  const offerSelectionGeneration = useRef(0);
  const [offers, setOffers] = useState<OfferSearchFeatureCollection>({
    features: [],
    type: 'FeatureCollection',
  });
  const offersRequestRef = useRef(0);
  const lastAreaWasEmptyRef = useRef(false);
  const { track } = useAnalytics();
  const [communityNotes, setCommunityNotes] = useState<FeatureCollection>({
    type: 'FeatureCollection',
    features: [],
  });
  const communityNotesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const communityNotesEventsRef = useRef<CommunityNoteFeature[]>([]);

  const parsedFilters: Partial<SearchFilters> = filters
    ? JSON.parse(filters)
    : {};
  const communityNotesEnabled =
    Boolean(parsedFilters.communityNotes) &&
    parsedFilters.connectionsOnly !== true;

  /**
   * Hook on map interactions to update features
   */
  const updateOffers = () => {
    // Don't fetch if viewing the whole world
    const zoom = viewport.zoom;
    if (zoom <= MIN_ZOOM || !boundsRef.current) {
      return;
    }

    const { northEast, southWest } = boundsRef.current;
    // Expand bounding box depending on the zoom level slightly to load more offers over the edge of the viewport
    const boundsBuffer = 10 / zoom;
    // Latitudes must be between -90 and 90
    // Longitudes must be between -180 and 180
    fetchOffers(
      {
        northEastLat: ensureValidLat(northEast.lat + boundsBuffer),
        northEastLng: ensureValidLng(northEast.lng + boundsBuffer),
        southWestLat: ensureValidLat(southWest.lat - boundsBuffer),
        southWestLng: ensureValidLng(southWest.lng - boundsBuffer),
      },
      zoom,
    );
  };

  /**
   * Refresh persistent map state when viewport changes
   */
  const onViewPortChange = (viewport: MapViewport, userInitiated = true) => {
    setViewport(viewport);

    const { latitude, longitude, zoom } = viewport;
    if (userInitiated) {
      stopDefaultLocation();
      debouncedSetPersistentMapLocation({ latitude, longitude, zoom });
    }
  };

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

  const clearPreviouslySelectedState = () => {
    if (selectedOffer) {
      mapRef.current?.setPointState(SOURCE_OFFERS, selectedOffer.id, {
        selected: false,
      });
      setSelectedOffer(false);
    }
  };

  const setSelectedState = (offer: MapPoint) => {
    clearPreviouslySelectedState();
    mapRef.current?.setPointState(SOURCE_OFFERS, offer.id, {
      selected: true,
      viewed: true,
    });
    setSelectedOffer(offer);
  };

  function openCommunityNote(feature: Pick<MapPoint, 'properties'>) {
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

  const zoomToCommunityNotesCluster = ({ latitude, longitude }: MapCluster) =>
    mapRef.current?.flyTo({
      latitude,
      longitude,
      zoom: Math.min((viewport.zoom || 2) + 3, CLUSTER_MAX_ZOOM),
    });

  const onClusterClick = (layerId: string, cluster: MapCluster) => {
    clearPreviouslySelectedState();
    if (layerId === SOURCE_OFFERS) {
      // Transition map to show offers in the cluster
      cluster.expansionZoom().then(
        zoom =>
          mapRef.current?.flyTo({
            latitude: cluster.latitude,
            longitude: cluster.longitude,
            zoom: Math.min(zoom + 1, CLUSTER_MAX_ZOOM),
          }),
        () => {},
      );
      return;
    }
    // Notes sharing one plus code open as a thread; others zoom in.
    cluster.leaves().then(
      leaves => {
        const plusCode = getPlusCodeFromEvent(
          leaves[0].properties as OfferFeatureProperties,
        );
        if (
          !leaves.every(
            leaf =>
              getPlusCodeFromEvent(
                leaf.properties as OfferFeatureProperties,
              ) === plusCode,
          )
        ) {
          zoomToCommunityNotesCluster(cluster);
          return;
        }
        onCommunityNoteOpen?.({
          notes: leaves.map(leaf =>
            reconstructEvent(leaf.properties as OfferFeatureProperties),
          ),
          plusCode,
        });
      },
      () => zoomToCommunityNotesCluster(cluster),
    );
  };

  const onPointClick = (layerId: string, point: MapPoint) => {
    clearPreviouslySelectedState();
    if (layerId === SOURCE_COMMUNITY_NOTES) {
      openCommunityNote(point);
    } else if (point.properties.id) {
      setSelectedState(point);
      openOfferById(String(point.properties.id));
    }
  };

  /**
   * Fetch offer data and open it in the search sidebar.
   */
  async function openOfferById(offerId: string) {
    const generation = ++offerSelectionGeneration.current;
    const offer = await getOffer(offerId);

    if (offer && generation === offerSelectionGeneration.current) {
      // Delegated to the search shell.
      // The offer endpoint returns the sidebar profile fields at runtime.
      onOfferOpen(offer);
    }
  }

  /**
   * Fetch offers inside bounding box
   */
  async function fetchOffers(
    boundingBox: Record<string, number>,
    zoom: number,
  ) {
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
        setOffers(data);
        // Count each move into an area without offers once, by zoom and
        // number of narrowing filters only, never by place.
        const isEmpty = data.features.length === 0;
        if (isEmpty && !lastAreaWasEmptyRef.current) {
          track('search_no_results', {
            zoom: Math.round(zoom),
            filters: countNarrowingFilters(parsedFilters),
          });
        }
        lastAreaWasEmptyRef.current = isEmpty;
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
    const { northEast, southWest } = boundsRef.current ?? {};
    const hasViewport =
      Boolean(northEast && southWest) && viewport.zoom > MIN_ZOOM;

    if (!hasViewport) {
      onVisibleOffersChange([]);
      onVisibleCommunityNoteThreadsChange([]);
      onVisibleMapCountsChange({});
      return;
    }

    const visibleOffers = offers.features.filter(feature => {
      const [longitude, latitude] = feature.geometry.coordinates;
      return isCoordinateInViewport(
        longitude,
        latitude,
        southWest!,
        northEast!,
      );
    });
    onVisibleOffersChange(visibleOffers.map(feature => feature.properties.id));
    const offerCounts = { host: 0, meet: 0 };
    for (const { properties } of visibleOffers) {
      if (properties.type) offerCounts[properties.type] += 1;
    }

    if (!communityNotesEnabled) {
      onVisibleCommunityNoteThreadsChange([]);
      onVisibleMapCountsChange(offerCounts);
      return;
    }

    const threads = new globalThis.Map<
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
    onVisibleMapCountsChange({ ...offerCounts, communityNotes: threads.size });
  }, [
    communityNotes,
    communityNotesEnabled,
    loaded,
    offers,
    onVisibleCommunityNoteThreadsChange,
    onVisibleMapCountsChange,
    onVisibleOffersChange,
    viewport,
  ]);

  // Apply externally changed bounds object
  // Changed by the search sidebar
  useEffect(() => {
    if (loaded && bounds?.northEast && bounds?.southWest) {
      // Persist the fitted view like a member's own move.
      interactionPending.current = true;
      mapRef.current?.fitBounds(bounds as MapBounds, {
        padding: 40,
        animate: false,
      });
    }
  }, [bounds, loaded]);

  // Apply externally changed filters object
  // Changed by the search sidebar
  useEffect(() => {
    offerSelectionGeneration.current += 1;
    clearPreviouslySelectedState();

    // Update map offers
    setOffers({ features: [], type: 'FeatureCollection' });
    updateOffers();
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
    if (
      location &&
      typeof location.lat === 'number' &&
      Number.isFinite(location.lat) &&
      typeof location.lng === 'number' &&
      Number.isFinite(location.lng)
    ) {
      if (location.clearSelection) {
        offerSelectionGeneration.current += 1;
        clearPreviouslySelectedState();
      }
      const next = {
        latitude: location.lat,
        longitude: location.lng,
        zoom: location.zoom ?? DEFAULT_LOCATION.zoom,
      };
      setTargetView(next);
      onViewPortChange(next);
    }
  }, [location]);

  const layers = useMemo(
    () => [
      {
        id: SOURCE_OFFERS,
        minZoom: MIN_ZOOM,
        clusterMaxZoom: CLUSTER_MAX_ZOOM,
        clusterMinPoints: 3,
        clusterColour: 'rgba(18, 181, 145, 0.7)',
        clusterTextColour: '#111',
        points: offers.features.map(({ geometry, properties }) => ({
          id: featureId(properties.id),
          longitude: geometry.coordinates[0],
          latitude: geometry.coordinates[1],
          colour: OFFER_COLOURS[String(properties.offer)] ?? '#ccc',
          properties: { ...properties },
        })),
      },
      ...(communityNotesEnabled
        ? [
            {
              id: SOURCE_COMMUNITY_NOTES,
              minZoom: MIN_ZOOM,
              clusterMaxZoom: 14,
              clusterColour: 'rgba(25, 118, 210, 0.7)',
              clusterTextColour: '#fff',
              points: communityNotes.features.map(
                ({ id, geometry, properties }) => ({
                  id,
                  longitude: geometry.coordinates[0],
                  latitude: geometry.coordinates[1],
                  colour: COMMUNITY_NOTE_COLOUR,
                  properties,
                }),
              ),
            },
          ]
        : []),
    ],
    [communityNotes, communityNotesEnabled, offers],
  );

  return (
    <div
      className="search-map"
      data-map-zoom={viewport.zoom}
      data-map-latitude={viewport.latitude}
      data-map-longitude={viewport.longitude}
      style={{ position: 'relative' }}
      onPointerDownCapture={onInteraction}
      onClickCapture={onInteraction}
      onTouchStartCapture={onInteraction}
      onWheelCapture={onInteraction}
      onKeyDownCapture={onInteraction}
    >
      <DeviceLocationButton
        onApproximateLocation={onApproximateLocation}
        onLocation={location => onDeviceLocation?.(location)}
        onRequest={() => {
          stopDefaultLocation();
          onDeviceLocationRequest?.();
        }}
      />
      <Map
        ref={mapRef}
        view={targetView}
        style={{ width: '100%', height: '100%' }}
        layers={layers}
        onPointClick={onPointClick}
        onClusterClick={onClusterClick}
        onClick={() => {
          clearPreviouslySelectedState();
          // Close open offers when clicking on map canvas
          onOfferClose();
        }}
        onLoad={(view, mapBounds) => {
          boundsRef.current = mapBounds;
          setLoaded(true);
          updateOffers();
        }}
        onMove={(view, mapBounds) => {
          boundsRef.current = mapBounds;
          onViewPortChange(view, interactionPending.current);
        }}
        onMoveEnd={() => {
          interactionPending.current = false;
          debouncedUpdateOffers();
        }}
      >
        {viewport.zoom <= MIN_ZOOM && <SearchMapNoContent />}
      </Map>
      {approximateLocation && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            left: 4,
            maxWidth: '65%',
            zIndex: 1,
          }}
        >
          <MapDefaultAttribution />
        </div>
      )}
    </div>
  );
}
