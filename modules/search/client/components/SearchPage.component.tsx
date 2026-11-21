import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { skipToken, useQuery } from '@tanstack/react-query';
import { Button } from '@trustroots/ui/Button';
import { ButtonGroup } from '@trustroots/ui/ButtonGroup';

import { useAnalytics } from '@trustroots/analytics/client';
import { matchesMediaQuery } from '@/modules/core/client/hooks/use-media-query';
import type { MapDefaultLocation } from '@/modules/core/client/utils/use-map-default-location';
import { getOffer, queryOffers } from '@/modules/offers/client/api/offers.api';
import type { SearchResultOffer } from './SearchSidebarResults.component';
import { get as getCircle } from '@/modules/tribes/client/api/tribes.api';
import { fetchLocationSuggestions, locatePlace } from '../api/location.api';
import SearchMap from './SearchMap.component';
import SearchPlaceInput from './SearchPlaceInput.component';
import SearchSidebar from './SearchSidebar.component';
import { getBoundsObject } from '../utils/location';
import {
  getSearchFilters,
  setSearchFilter,
  setSearchFilters,
} from '../utils/search-filters';

interface SearchUser {
  _id?: string;
  public?: boolean;
}

interface SearchRouteParams {
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

const noOfferIds: string[] = [];
const CITY_SEARCH_HALF_SPAN_DEGREES = 0.1;

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
  const setOfferQueryParam = (offerId?: string) =>
    void navigate({
      hash: true,
      replace: true,
      search: (search: Record<string, string>) => ({
        ...search,
        offer: offerId || undefined,
      }),
      to: '/search',
    });
  const isUserPublic = Boolean(user?.public);
  const initialFilters = useMemo(
    () => getSearchFilters(user?._id),
    [user?._id],
  );

  const [filters, setFiltersState] = useState(initialFilters);
  const [filtersJson, setFiltersJson] = useState(
    JSON.stringify(initialFilters),
  );
  const [bounds, setBounds] = useState<Partial<SearchMapBounds>>({});
  const [location, setLocation] = useState<Partial<SearchMapLocation>>({});
  const [citySearch, setCitySearch] = useState<{
    name: string;
    bounds: SearchMapBounds;
  } | null>(null);
  const placeSearchGenerationRef = useRef(0);
  const locationNavigationGenerationRef = useRef(0);
  const [offer, setOffer] = useState<SearchResultOffer | null>(null);
  const locallyPreviewedOfferIdRef = React.useRef<string | null>(null);
  const [communityNoteThreads, setCommunityNoteThreads] = useState<
    SearchCommunityNote[]
  >([]);
  const [visibleOfferIds, setVisibleOfferIds] = useState<string[]>([]);
  const [resultOffers, setResultOffers] = useState<{
    ids: string[];
    offers: SearchResultOffer[];
  }>({ ids: noOfferIds, offers: [] });
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
  const [communityNotesEnabled, setCommunityNotesEnabled] = useState(
    initialFilters.communityNotes,
  );
  const [onlineInPast6Months, setOnlineInPast6Months] = useState(
    initialFilters.seen?.months === 6,
  );
  const cityFilters = JSON.stringify({ ...filters, types: ['host'] });
  const cityOffers = useQuery({
    queryKey: ['city-host-offers', user?._id, citySearch?.bounds, cityFilters],
    queryFn: citySearch
      ? async () => {
          const { northEast, southWest } = citySearch.bounds;
          const { features } = await queryOffers({
            filters: cityFilters,
            northEastLat: northEast.lat,
            northEastLng: northEast.lng,
            southWestLat: southWest.lat,
            southWestLng: southWest.lng,
          });
          return features
            .filter(({ properties }) => properties.type === 'host')
            .map(({ properties }) => properties.id);
        }
      : skipToken,
  });
  const resultOfferIds = citySearch
    ? (cityOffers.data ?? noOfferIds)
    : visibleOfferIds;
  const isLoadingCityOffers =
    Boolean(citySearch) &&
    (cityOffers.isPending || resultOffers.ids !== resultOfferIds);

  const requestDeviceLocation = useCallback(() => {
    placeSearchGenerationRef.current += 1;
  }, []);

  const clearSelection = useCallback(
    ({ clearOfferParam = true }: { clearOfferParam?: boolean } = {}) => {
      locallyPreviewedOfferIdRef.current = null;
      setOffer(null);
      setCommunityNote(null);
      setIsLoadingOffer(false);
      if (clearOfferParam) {
        setOfferQueryParam('');
      }
    },
    [],
  );

  const handleDeviceLocation = useCallback(
    ({ lat, lng, zoom = 13 }: { lat: number; lng: number; zoom?: number }) => {
      locationNavigationGenerationRef.current += 1;
      clearSelection();
      setCitySearch(null);
      setBounds({});
      setLocation({ lat, lng, zoom, clearSelection: true });
      setSearchQuery('');
      setIsPlaceSearchVisible(false);
      const url = new URL(window.location.href);
      url.searchParams.delete('location');
      window.history.replaceState({}, '', url);
    },
    [clearSelection],
  );

  const handleApproximateLocation = useCallback(
    ({ latitude, longitude, zoom }: MapDefaultLocation) => {
      handleDeviceLocation({ lat: latitude, lng: longitude, zoom });
    },
    [handleDeviceLocation],
  );

  const updateFilters = useCallback(
    (partialFilters: Partial<ReturnType<typeof getSearchFilters>>) => {
      const nextFilters = setSearchFilters(user?._id, partialFilters);
      setFiltersState(nextFilters);
      setFiltersJson(JSON.stringify(nextFilters));
      setCommunityNotesEnabled(nextFilters.communityNotes);
      setOnlineInPast6Months(nextFilters.seen?.months === 6);
      clearSelection();
    },
    [clearSelection, user?._id],
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
    setCitySearch(null);
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

      locallyPreviewedOfferIdRef.current = reCenterMap
        ? null
        : nextOffer._id || null;
      setOffer(nextOffer);
      setCommunityNote(null);
      setIsLoadingOffer(false);
      setOfferQueryParam(nextOffer._id);
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
    [openSidebar, track],
  );

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
    if (!isSidebarOpen || sidebarTab !== 'results' || offer || communityNote) {
      return undefined;
    }

    let isMounted = true;

    async function loadVisibleOffers() {
      const cachedOffers = resultOfferIds
        .map(id => offerCache.current.get(id))
        .filter((item): item is SearchResultOffer => Boolean(item));
      setResultOffers({ ids: resultOfferIds, offers: cachedOffers });

      const missingIds = resultOfferIds.filter(
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
      setResultOffers({
        ids: resultOfferIds,
        offers: resultOfferIds
          .map(id => loadedById.get(id))
          .filter((item): item is SearchResultOffer => Boolean(item)),
      });
      setIsLoadingVisibleOffers(false);
    }

    loadVisibleOffers();

    return () => {
      isMounted = false;
    };
  }, [communityNote, isSidebarOpen, offer, sidebarTab, resultOfferIds]);

  const onPlaceSearch = useCallback(
    (
      data: SearchMapLocation | SearchMapBounds,
      type: 'center' | 'bounds',
      cityName?: string,
    ) => {
      setIsPlaceSearchVisible(false);

      if (cityName && isUserPublic) {
        placeSearchGenerationRef.current += 1;
        locationNavigationGenerationRef.current += 1;
        clearSelection();
        const { lat, lng } = data as SearchMapLocation;
        const halfSpan = CITY_SEARCH_HALF_SPAN_DEGREES;
        const cityBounds =
          type === 'bounds'
            ? (data as SearchMapBounds)
            : getBoundsObject(
                Math.min(lat + halfSpan, 90),
                Math.min(lng + halfSpan, 180),
                Math.max(lat - halfSpan, -90),
                Math.max(lng - halfSpan, -180),
              );
        setCitySearch({ name: cityName, bounds: cityBounds });
        setLocation({});
        setBounds(cityBounds);
        openSidebar('results');
        return;
      }

      setCitySearch(null);
      /* istanbul ignore else -- callers only emit centre or bounds results. */
      if (data && type === 'center') {
        setBounds({});
        setLocation(data as SearchMapLocation);
      } else if (data && type === 'bounds') {
        setLocation({});
        setBounds(data as SearchMapBounds);
      }
    },
    [clearSelection, isUserPublic, openSidebar],
  );

  useEffect(() => {
    const requestGeneration = placeSearchGenerationRef.current;
    let isMounted = true;

    async function initialiseFromUrl() {
      if (routeParams.tribe) {
        try {
          const tribe = await getCircle(routeParams.tribe);

          if (isMounted && tribe?._id) {
            updateFilters({ tribes: [tribe._id] });
          }
        } catch {
          // Ignore invalid tribe slugs.
        }
      }

      if (searchQuery) {
        const suggestions = await fetchLocationSuggestions(searchQuery);

        if (
          isMounted &&
          requestGeneration === placeSearchGenerationRef.current &&
          suggestions.length
        ) {
          const located = locatePlace(suggestions[0]);

          if (located) {
            onPlaceSearch(located.data, located.type);
            setSearchQuery(suggestions[0].trTitle);
          }
        }
      }
    }

    initialiseFromUrl();

    return () => {
      isMounted = false;
    };
  }, []);

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
            <Button render={<a href="/search/members" />}>Members</Button>
          </ButtonGroup>
        </ButtonGroup>
      </div>

      {isPlaceSearchVisible && (
        <div className="tw:block tw:sm:hidden panel panel-default search-map-place">
          <SearchPlaceInput
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
            cityName={citySearch?.name}
            communityNote={communityNote}
            communityNoteThreads={citySearch ? [] : communityNoteThreads}
            communityNotesEnabled={communityNotesEnabled}
            filters={filters}
            hasCitySearchError={Boolean(
              citySearch && cityOffers.isLoadingError,
            )}
            isLoadingOffer={isLoadingOffer}
            offer={offer}
            offers={isLoadingCityOffers ? [] : resultOffers.offers}
            onOfferSelect={previewOffer}
            onCommunityNoteSelect={previewCommunityNote}
            onBackToOffers={closeOffer}
            isLoadingOffers={isLoadingCityOffers || isLoadingVisibleOffers}
            onCloseSidebar={() => toggleSidebar()}
            onCommunityNotesToggle={() => {
              const nextValue = !communityNotesEnabled;
              setCommunityNotesEnabled(nextValue);
              setSearchFilter(user?._id, 'communityNotes', nextValue);
              updateFilters({ communityNotes: nextValue });
            }}
            onFiltersChange={updateFilters}
            onOnlineInPast6MonthsChange={() => {
              const months = onlineInPast6Months ? 24 : 6;
              setOnlineInPast6Months(!onlineInPast6Months);
              updateFilters({ seen: { months } });
            }}
            onPlaceSearch={onPlaceSearch}
            onRetryCitySearch={() => void cityOffers.refetch()}
            onTabSelect={setSidebarTab}
            onlineInPast6Months={onlineInPast6Months}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
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
          filters={filtersJson}
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
          onVisibleOffersChange={updateVisibleOfferIds}
        />
      </div>
    </section>
  );
}
