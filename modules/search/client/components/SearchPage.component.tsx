import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Button } from '@trustroots/ui/Button';
import { ButtonGroup } from '@trustroots/ui/ButtonGroup';

import { useAnalytics } from '@trustroots/analytics/client';
import { matchesMediaQuery } from '@/modules/core/client/hooks/use-media-query';
import type { MapDefaultLocation } from '@/modules/core/client/utils/use-map-default-location';
import { getOffer } from '@/modules/offers/client/api/offers.api';
import type { PlaceHostSort } from '@/modules/offers/shared/offer';
import { getCitySearch, type CitySearch } from '../utils/location';
import useCityHosts from '../hooks/use-city-hosts';
import type { SearchResultOffer } from './SearchSidebarResults.component';
import { get as getCircle } from '@/modules/tribes/client/api/tribes.api';
import { fetchLocationSuggestions, locatePlace } from '../api/location.api';
import lazyMap from '@/modules/core/client/components/lazyMap';
import type { VisibleMapCounts } from './SearchMap.component';
import SearchPlaceInput from './SearchPlaceInput.component';
import SearchSidebar from './SearchSidebar.component';
import {
  getSearchFilters,
  normalizeTypes,
  readSearchFiltersParam,
  setSearchFilters,
  type SearchFilters,
} from '../utils/search-filters';

const SearchMap = lazyMap(() => import('./SearchMap.component'));

interface SearchUser {
  _id?: string;
  public?: boolean;
}

interface SearchRouteParams {
  filters?: string;
  location?: string;
  offer?: string;
  tribe?: string;
}

interface SearchMapLocation {
  lat: number;
  lng: number;
  zoom?: number;
  clearSelection?: boolean;
}

interface SearchMapBounds {
  northEast: { lat: number; lng: number };
  southWest: { lat: number; lng: number };
}

interface SearchCommunityNote {
  notes: import('nostr-tools').Event[];
  plusCode: string | null;
}

function parseLocationQuery(locationParam?: string): string {
  if (!locationParam) {
    return '';
  }

  return locationParam.replace(/_/g, ' ').replace(/\+/g, ' ');
}

export default function SearchPage({ user }: { user?: SearchUser | null }) {
  const { track } = useAnalytics();
  const routeParams: SearchRouteParams = useSearch({ strict: false });
  const navigate = useNavigate();
  const updateSearchParams = useCallback(
    (params: Partial<SearchRouteParams>, replace = true) =>
      void navigate({
        hash: true,
        replace,
        search: (search: Record<string, string>) => ({ ...search, ...params }),
        to: '/search',
      }),
    [navigate],
  );
  const isUserPublic = Boolean(user?.public);
  const [initialFilters] = useState(() => getSearchFilters(user?._id));
  const urlFilters = useMemo(
    () => readSearchFiltersParam(routeParams.filters),
    [routeParams.filters],
  );
  const [legacyTribe, setLegacyTribe] = useState<{
    slug: string;
    id: string;
  }>();
  const filters =
    urlFilters ??
    (legacyTribe && legacyTribe.slug === routeParams.tribe
      ? { ...initialFilters, tribes: [legacyTribe.id] }
      : initialFilters);
  const [bounds, setBounds] = useState<Partial<SearchMapBounds>>({});
  const [city, setCity] = useState<CitySearch>();
  const [showCityResults, setShowCityResults] = useState(false);
  const [citySort, setCitySort] = useState<PlaceHostSort>('name');
  const [canHost, setCanHost] = useState(false);
  const [placeOfferError, setPlaceOfferError] = useState(false);
  const placeOfferRequest = useRef(0);
  const [location, setLocation] = useState<Partial<SearchMapLocation>>({});
  const placeSearchGenerationRef = useRef(0);
  const locallySelectedPlaceRef = useRef<string | undefined>(undefined);
  const locationNavigationGenerationRef = useRef(0);
  const [offer, setOffer] = useState<SearchResultOffer | null>(null);
  const locallyPreviewedOfferIdRef = React.useRef<string | null>(null);
  const [communityNoteThreads, setCommunityNoteThreads] = useState<
    SearchCommunityNote[]
  >([]);
  const [visibleOfferIds, setVisibleOfferIds] = useState<string[]>([]);
  const [visibleMapCounts, setVisibleMapCounts] = useState<VisibleMapCounts>();
  const [visibleOffers, setVisibleOffers] = useState<SearchResultOffer[]>([]);
  const [isLoadingVisibleOffers, setIsLoadingVisibleOffers] = useState(false);
  const offerCache = useRef(new Map<string, SearchResultOffer>());
  const offerRequests = useRef(
    new Map<string, Promise<SearchResultOffer | null>>(),
  );
  const [communityNote, setCommunityNote] =
    useState<SearchCommunityNote | null>(null);
  const [isLoadingOffer, setIsLoadingOffer] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'filters' | 'results'>(
    'filters',
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    Boolean(routeParams.offer) ||
      (isUserPublic && matchesMediaQuery('(min-width: 768px)')),
  );
  const [isPlaceSearchVisible, setIsPlaceSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState(
    parseLocationQuery(routeParams.location),
  );
  const communityNotesEnabled = filters.communityNotes;
  const onlineInPast6Months = filters.seen?.months === 6;

  const cityFilters = JSON.stringify({
    tribes: filters.tribes,
    languages: filters.languages,
    seen: filters.seen,
    volunteering: filters.volunteering,
    connectionsOnly: filters.connectionsOnly,
  });
  const cityHosts = useCityHosts({
    viewer: user?._id,
    bounds: city?.bounds,
    filters: cityFilters,
    sort: citySort,
    canHost,
    enabled:
      isUserPublic &&
      isSidebarOpen &&
      sidebarTab === 'results' &&
      showCityResults,
  });

  const requestDeviceLocation = useCallback(() => {
    placeSearchGenerationRef.current += 1;
  }, []);

  const clearSelection = useCallback(
    ({ clearOfferParam = true }: { clearOfferParam?: boolean } = {}) => {
      placeOfferRequest.current += 1;
      setPlaceOfferError(false);
      locallyPreviewedOfferIdRef.current = null;
      setOffer(null);
      setCommunityNote(null);
      setIsLoadingOffer(false);
      if (clearOfferParam) {
        updateSearchParams({ offer: undefined });
      }
    },
    [updateSearchParams],
  );

  const handleDeviceLocation = useCallback(
    ({ lat, lng, zoom = 13 }: { lat: number; lng: number; zoom?: number }) => {
      locationNavigationGenerationRef.current += 1;
      clearSelection({ clearOfferParam: false });
      setBounds({});
      setLocation({ lat, lng, zoom, clearSelection: true });
      setSearchQuery('');
      setCity(undefined);
      setShowCityResults(false);
      setIsPlaceSearchVisible(false);
      updateSearchParams({ location: undefined, offer: undefined });
    },
    [clearSelection, updateSearchParams],
  );

  const handleApproximateLocation = useCallback(
    ({ latitude, longitude, zoom }: MapDefaultLocation) => {
      handleDeviceLocation({ lat: latitude, lng: longitude, zoom });
    },
    [handleDeviceLocation],
  );

  const updateFilters = useCallback(
    (partialFilters: Partial<SearchFilters>) => {
      const nextFilters = { ...filters, ...partialFilters };
      nextFilters.types = normalizeTypes(nextFilters.types);
      setSearchFilters(user?._id, nextFilters);
      clearSelection({ clearOfferParam: false });
      updateSearchParams(
        {
          filters: JSON.stringify(nextFilters),
          offer: undefined,
          ...(partialFilters.tribes ? { tribe: undefined } : {}),
        },
        false,
      );
    },
    [clearSelection, filters, updateSearchParams, user?._id],
  );

  const openSidebar = useCallback((tab?: 'filters' | 'results') => {
    setIsSidebarOpen(true);

    if (tab) {
      setSidebarTab(tab);
    }
  }, []);

  const updateVisibleOfferIds = useCallback((offerIds: string[]) => {
    setVisibleOfferIds(previous =>
      previous.length === offerIds.length &&
      previous.every((id, index) => id === offerIds[index])
        ? previous
        : offerIds,
    );
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
    clearSelection();
  }, [clearSelection]);

  const toggleSidebar = useCallback(
    (tab?: 'filters' | 'results') => {
      if (isSidebarOpen) {
        closeSidebar();
      } else {
        openSidebar(tab);
      }
    },
    [closeSidebar, isSidebarOpen, openSidebar],
  );

  const previewOffer = useCallback(
    (nextOffer: SearchResultOffer, reCenterMap = false) => {
      if (!nextOffer?.location) {
        return;
      }

      placeOfferRequest.current += 1;
      setPlaceOfferError(false);
      locallyPreviewedOfferIdRef.current = reCenterMap
        ? null
        : nextOffer._id || null;
      setOffer(nextOffer);
      setCommunityNote(null);
      setIsLoadingOffer(false);
      updateSearchParams({ offer: nextOffer._id });
      openSidebar('results');

      if (reCenterMap) {
        setBounds({});
        setLocation({
          lat: nextOffer.location[0],
          lng: nextOffer.location[1],
          zoom: 13,
        });
      }

      track('search_offer_previewed');
    },
    [openSidebar, track, updateSearchParams],
  );

  async function previewCityHost(id: string) {
    const request = ++placeOfferRequest.current;
    setPlaceOfferError(false);
    setIsLoadingOffer(true);

    try {
      const loaded = await getOffer(id);
      if (placeOfferRequest.current === request) previewOffer(loaded);
    } catch {
      if (placeOfferRequest.current === request) {
        setIsLoadingOffer(false);
        setPlaceOfferError(true);
      }
    }
  }

  const previewCommunityNote = useCallback(
    (data: SearchCommunityNote) => {
      clearSelection({ clearOfferParam: false });
      setCommunityNote(data);
      openSidebar('results');
      // Opened from the map or the sidebar list.
      track('search_community_note_opened');
    },
    [clearSelection, openSidebar, track],
  );

  const closeOffer = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  useEffect(() => {
    if (
      !isSidebarOpen ||
      sidebarTab !== 'results' ||
      showCityResults ||
      offer ||
      communityNote
    ) {
      return undefined;
    }

    let isMounted = true;

    async function loadVisibleOffers() {
      const cachedOffers = visibleOfferIds
        .map(id => offerCache.current.get(id))
        .filter((item): item is SearchResultOffer => Boolean(item));
      setVisibleOffers(cachedOffers);

      const missingIds = visibleOfferIds.filter(
        id => !offerCache.current.has(id),
      );
      setIsLoadingVisibleOffers(missingIds.length > 0);
      const loadedOffers: (SearchResultOffer | null)[] = [];
      for (let index = 0; index < missingIds.length; index += 8) {
        if (!isMounted) return;
        const batch = missingIds.slice(index, index + 8);
        loadedOffers.push(
          ...(await Promise.all(
            batch.map(id => {
              let request = offerRequests.current.get(id);
              if (!request) {
                request = getOffer(id)
                  .then(loaded => {
                    if (!loaded) return null;
                    const result = loaded as unknown as SearchResultOffer;
                    const offer = { ...result, _id: id };
                    offerCache.current.delete(id);
                    offerCache.current.set(id, offer);
                    while (offerCache.current.size > 250) {
                      const oldestId = offerCache.current.keys().next()
                        .value as string;
                      offerCache.current.delete(oldestId);
                    }
                    return offer;
                  })
                  .catch(() => null)
                  .finally(() => offerRequests.current.delete(id));
                offerRequests.current.set(id, request);
              }
              return request;
            }),
          )),
        );
      }

      if (!isMounted) return;

      const completedOffers = loadedOffers.filter(
        (item): item is SearchResultOffer => Boolean(item),
      );
      const loadedById = new Map<string, SearchResultOffer>(
        [...cachedOffers, ...completedOffers].map(item => [item._id!, item]),
      );
      setVisibleOffers(
        visibleOfferIds
          .map(id => loadedById.get(id))
          .filter((item): item is SearchResultOffer => Boolean(item)),
      );
      setIsLoadingVisibleOffers(false);
    }

    loadVisibleOffers();

    return () => {
      isMounted = false;
    };
  }, [
    communityNote,
    isSidebarOpen,
    offer,
    showCityResults,
    sidebarTab,
    visibleOfferIds,
  ]);

  const onPlaceSearch = useCallback(
    (
      data: SearchMapLocation | SearchMapBounds,
      type: 'center' | 'bounds',
      nextCity?: CitySearch,
      preserveOffer = false,
    ) => {
      placeSearchGenerationRef.current += 1;
      setIsPlaceSearchVisible(false);
      setCity(nextCity);
      setShowCityResults(Boolean(nextCity));

      if (nextCity) {
        if (!preserveOffer) {
          locationNavigationGenerationRef.current += 1;
          clearSelection({ clearOfferParam: false });
          setLocation({});
          setBounds(nextCity.bounds);
        }
        openSidebar('results');
        return;
      }

      /* istanbul ignore else -- callers only emit centre or bounds results. */
      if (data && type === 'center') {
        setBounds({});
        setLocation(data as SearchMapLocation);
      } else if (data && type === 'bounds') {
        setLocation({});
        setBounds(data as SearchMapBounds);
      }
    },
    [clearSelection, openSidebar],
  );

  const updatePlaceQuery = useCallback(
    (location?: string) => {
      placeSearchGenerationRef.current += 1;
      if (!location) {
        updateSearchParams({ location: undefined }, false);
        return;
      }

      locationNavigationGenerationRef.current += 1;
      locallySelectedPlaceRef.current = location;
      clearSelection({ clearOfferParam: false });
      const hasPendingLegacyTribe =
        routeParams.tribe &&
        !urlFilters &&
        legacyTribe?.slug !== routeParams.tribe;
      updateSearchParams(
        {
          location,
          offer: undefined,
          ...(hasPendingLegacyTribe
            ? {}
            : { filters: JSON.stringify(filters) }),
        },
        false,
      );
    },
    [
      clearSelection,
      filters,
      legacyTribe,
      routeParams.tribe,
      updateSearchParams,
      urlFilters,
    ],
  );

  useEffect(() => {
    const slug = routeParams.tribe;
    if (!slug || urlFilters) return;
    let isMounted = true;

    void getCircle(slug)
      .then(tribe => {
        if (isMounted && tribe?._id) {
          setLegacyTribe({ slug, id: tribe._id });
        }
      })
      .catch(() => {
        // Ignore invalid tribe slugs.
      });

    return () => {
      isMounted = false;
    };
  }, [routeParams.tribe, urlFilters]);

  useEffect(() => {
    const locallySelected = locallySelectedPlaceRef.current;
    locallySelectedPlaceRef.current = undefined;
    if (routeParams.location && locallySelected === routeParams.location)
      return;

    const placeQuery = parseLocationQuery(routeParams.location);
    setSearchQuery(placeQuery);
    if (!placeQuery) return;

    const requestGeneration = placeSearchGenerationRef.current;
    let isMounted = true;
    async function restorePlace() {
      const [suggestion] = await fetchLocationSuggestions(placeQuery);
      if (
        isMounted &&
        requestGeneration === placeSearchGenerationRef.current &&
        suggestion
      ) {
        const located = locatePlace(suggestion);
        if (located) {
          const linkedCity = getCitySearch(suggestion);
          // An offer deep link takes priority over the place's viewport.
          if (linkedCity || !routeParams.offer) {
            onPlaceSearch(
              located.data,
              located.type,
              linkedCity,
              Boolean(routeParams.offer),
            );
          }
          setSearchQuery(suggestion.trTitle);
        }
      }
    }
    void restorePlace();

    return () => {
      isMounted = false;
    };
  }, [routeParams.location]);

  useEffect(() => {
    // A pin click already supplies the offer and must preserve the viewport.
    if (
      routeParams.offer &&
      (routeParams.offer === offer?._id ||
        routeParams.offer === locallyPreviewedOfferIdRef.current)
    ) {
      return;
    }
    let isMounted = true;
    const locationNavigationGeneration =
      locationNavigationGenerationRef.current;
    clearSelection({ clearOfferParam: false });

    async function loadOfferFromUrl() {
      if (routeParams.offer && routeParams.offer.length === 24) {
        setIsLoadingOffer(true);
        openSidebar('results');

        try {
          const loadedOffer = await getOffer(routeParams.offer);

          if (
            isMounted &&
            locationNavigationGeneration ===
              locationNavigationGenerationRef.current
          ) {
            // Search results include the profile fields used by the sidebar.
            previewOffer(loadedOffer as unknown as SearchResultOffer, true);
          }
        } catch {
          if (
            isMounted &&
            locationNavigationGeneration ===
              locationNavigationGenerationRef.current
          ) {
            clearSelection({ clearOfferParam: false });
            track('search_offer_not_found');
          }
        }
      }
    }

    loadOfferFromUrl();

    return () => {
      isMounted = false;
    };
  }, [routeParams.offer]);

  const toggleRecentActivity = () =>
    updateFilters({ seen: { months: onlineInPast6Months ? 24 : 6 } });

  return (
    <section className={`search${isSidebarOpen ? ' is-sidebar-open' : ''}`}>
      <div className="tw:block tw:sm:hidden panel panel-default search-map-meta">
        <ButtonGroup aria-label="Search settings" justified role="group">
          <ButtonGroup size="lg" role="group">
            <Button
              onClick={() => {
                setIsPlaceSearchVisible(true);
                closeSidebar();
                window.setTimeout(() => {
                  document.getElementById('search-query')?.focus();
                }, 0);
              }}
              type="button"
            >
              <i className="icon-search"></i>
              Search places
            </Button>
          </ButtonGroup>
          <ButtonGroup size="lg" role="group">
            <Button onClick={() => openSidebar('filters')} type="button">
              <i className="icon-sliders"></i>
              Filters
            </Button>
          </ButtonGroup>
          <ButtonGroup size="lg" role="group">
            {city ? (
              <Button
                onClick={() => {
                  setShowCityResults(true);
                  openSidebar('results');
                }}
                type="button"
              >
                Hosts
              </Button>
            ) : (
              <Button render={<a href="/search/members" />}>Members</Button>
            )}
          </ButtonGroup>
        </ButtonGroup>
      </div>

      {isPlaceSearchVisible && (
        <div className="tw:block tw:sm:hidden panel panel-default search-map-place">
          <SearchPlaceInput
            onPlaceQueryChange={updatePlaceQuery}
            onPlaceSearch={onPlaceSearch}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
          <Button
            intent="primary"
            size="xl"
            className="tw:block tw:sm:hidden search-sidebar-close"
            onClick={() => setIsPlaceSearchVisible(false)}
            type="button"
          >
            Back to map
          </Button>
        </div>
      )}

      {isUserPublic && (
        <div className="search-sidebar-toggle tw:max-sm:hidden">
          <Button
            aria-label={
              isSidebarOpen ? 'Hide search filters' : 'Open search filters'
            }
            variant="link"
            onClick={() => toggleSidebar()}
            title={isSidebarOpen ? 'Collapse side panel' : 'Open side panel'}
            type="button"
          >
            <i
              className={`tw:max-sm:hidden ${
                isSidebarOpen ? 'icon-left' : 'icon-right'
              }`}
            ></i>
          </Button>
        </div>
      )}

      {isUserPublic && isSidebarOpen && (
        <aside
          className={`search-sidebar-container${
            offer || isLoadingOffer || communityNote ? ' is-offer-open' : ''
          }`}
        >
          <SearchSidebar
            activeTab={sidebarTab}
            cityResults={
              city && {
                city,
                active: showCityResults,
                onViewChange: setShowCityResults,
                sort: citySort,
                onSortChange: setCitySort,
                canHost,
                onCanHostChange: setCanHost,
                onlyRecent: onlineInPast6Months,
                onToggleRecent: toggleRecentActivity,
                query: cityHosts,
                onSelectHost: previewCityHost,
                offerError: placeOfferError,
              }
            }
            communityNote={communityNote}
            communityNoteThreads={communityNoteThreads}
            communityNotesEnabled={communityNotesEnabled}
            filters={filters}
            isLoadingOffer={isLoadingOffer}
            offer={offer}
            offers={visibleOffers}
            onOfferSelect={previewOffer}
            onCommunityNoteSelect={previewCommunityNote}
            onBackToOffers={closeOffer}
            isLoadingOffers={isLoadingVisibleOffers}
            onCloseSidebar={() => toggleSidebar()}
            onCommunityNotesToggle={() =>
              updateFilters({ communityNotes: !communityNotesEnabled })
            }
            onFiltersChange={updateFilters}
            onOnlineInPast6MonthsChange={toggleRecentActivity}
            onPlaceQueryChange={updatePlaceQuery}
            onPlaceSearch={onPlaceSearch}
            onTabSelect={setSidebarTab}
            onlineInPast6Months={onlineInPast6Months}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            visibleMapCounts={visibleMapCounts}
          />
        </aside>
      )}

      <div className="search-map-container">
        {!isUserPublic && (
          <div
            aria-labelledby="activate-profile-message"
            className="search-message search-message-solid"
            role="alertdialog"
          >
            <div role="document">
              <h4 id="activate-profile-message">
                Sorry, you need to first activate your profile before you can
                browse others.
              </h4>
              <p className="lead">
                If you did not receive the confirmation message, check your spam
                folder or resend it via{' '}
                <a href="/profile/edit/account">email settings</a>.
              </p>
            </div>
          </div>
        )}

        <SearchMap
          filters={JSON.stringify(filters)}
          isUserPublic={isUserPublic}
          location={location}
          locationBounds={bounds}
          onApproximateLocation={handleApproximateLocation}
          onCommunityNoteOpen={previewCommunityNote}
          onDeviceLocation={handleDeviceLocation}
          onDeviceLocationRequest={requestDeviceLocation}
          onOfferClose={closeOffer}
          onOfferOpen={previewOffer}
          onVisibleCommunityNoteThreadsChange={setCommunityNoteThreads}
          onVisibleMapCountsChange={setVisibleMapCounts}
          onVisibleOffersChange={updateVisibleOfferIds}
        />
      </div>
    </section>
  );
}
