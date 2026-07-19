import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getCurrentRouteParams,
  trackEvent,
} from '@/modules/core/client/services/client-runtime';
import { getOffer } from '@/modules/offers/client/api/offers.api';
import { get as getCircle } from '@/modules/tribes/client/api/tribes.api';
import { fetchLocationSuggestions, locatePlace } from '../api/location.api';
import SearchMap from './SearchMap.component';
import SearchPlaceInput from './SearchPlaceInput.component';
import SearchSidebar from './SearchSidebar.component';
import {
  getSearchFilters,
  setSearchFilter,
  setSearchFilters,
} from '../utils/search-filters';

function parseLocationQuery(locationParam) {
  if (!locationParam) {
    return '';
  }

  return locationParam.replace(/_/g, ' ').replace(/\+/g, ' ');
}

function setOfferQueryParam(offerId) {
  const url = new URL(window.location.href);

  if (offerId) {
    url.searchParams.set('offer', offerId);
  } else {
    url.searchParams.delete('offer');
  }

  window.history.replaceState({}, '', url);
}

export default function SearchPage({ user }) {
  const routeParams = getCurrentRouteParams();
  const isUserPublic = Boolean(user?.public);
  const initialFilters = useMemo(
    () => getSearchFilters(user?._id),
    [user?._id],
  );

  const [filters, setFiltersState] = useState(initialFilters);
  const [filtersJson, setFiltersJson] = useState(
    JSON.stringify(initialFilters),
  );
  const [bounds, setBounds] = useState({});
  const [location, setLocation] = useState({});
  const [offer, setOffer] = useState(false);
  const [communityNote, setCommunityNote] = useState(false);
  const [isLoadingOffer, setIsLoadingOffer] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('filters');
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    Boolean(routeParams.offer) || (isUserPublic && window.innerWidth >= 768),
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

  const updateFilters = useCallback(
    partialFilters => {
      const nextFilters = setSearchFilters(user?._id, partialFilters);
      setFiltersState(nextFilters);
      setFiltersJson(JSON.stringify(nextFilters));
      setCommunityNotesEnabled(nextFilters.communityNotes);
      setOnlineInPast6Months(nextFilters.seen?.months === 6);
      setOffer(false);
      setCommunityNote(false);
      setOfferQueryParam('');
    },
    [user?._id],
  );

  const openSidebar = useCallback(tab => {
    setIsSidebarOpen(true);

    if (tab) {
      setSidebarTab(tab);
    }
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
    setOffer(false);
    setCommunityNote(false);
    setIsLoadingOffer(false);
    setOfferQueryParam('');
  }, []);

  const toggleSidebar = useCallback(
    tab => {
      if (isSidebarOpen) {
        closeSidebar(tab);
      } else {
        openSidebar(tab);
      }
    },
    [closeSidebar, isSidebarOpen, openSidebar],
  );

  const previewOffer = useCallback(
    (nextOffer, reCenterMap = false) => {
      if (!nextOffer?.location) {
        return;
      }

      setOffer(nextOffer);
      setCommunityNote(false);
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

      trackEvent('offer.preview', {
        category: 'search.map',
        label: 'Preview offer',
      });
    },
    [openSidebar],
  );

  const previewCommunityNote = useCallback(
    data => {
      setOffer(false);
      setCommunityNote(data);
      setIsLoadingOffer(false);
      openSidebar('results');
    },
    [openSidebar],
  );

  const closeOffer = useCallback(() => {
    setOffer(false);
    setCommunityNote(false);
    setIsLoadingOffer(false);
    setOfferQueryParam('');
  }, []);

  const onPlaceSearch = useCallback((data, type) => {
    setIsPlaceSearchVisible(false);

    /* istanbul ignore else -- callers only emit centre or bounds results. */
    if (data && type === 'center') {
      setBounds({});
      setLocation(data);
    } else if (data && type === 'bounds') {
      setLocation({});
      setBounds(data);
    }
  }, []);

  useEffect(() => {
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

        if (isMounted && suggestions.length) {
          const located = locatePlace(suggestions[0]);

          if (located) {
            onPlaceSearch(located.data, located.type);
            setSearchQuery(suggestions[0].trTitle);
          }
        }
      }

      if (routeParams.offer && routeParams.offer.length === 24) {
        setIsLoadingOffer(true);
        openSidebar('results');

        try {
          const loadedOffer = await getOffer(routeParams.offer);

          if (isMounted) {
            previewOffer(loadedOffer, true);
          }
        } catch {
          if (isMounted) {
            setIsLoadingOffer(false);
            setOffer(false);
            trackEvent('offer-not-found', {
              category: 'search.map',
              label: 'Offer not found',
            });
          }
        }
      }
    }

    initialiseFromUrl();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className={`search${isSidebarOpen ? ' is-sidebar-open' : ''}`}>
      <div className="visible-xs-block panel panel-default search-map-meta">
        <div
          aria-label="Search settings"
          className="btn-group btn-group-justified"
          role="group"
        >
          <div className="btn-group btn-group-lg" role="group">
            <button
              className="btn btn-default"
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
            </button>
          </div>
          <div className="btn-group btn-group-lg" role="group">
            <button
              className="btn btn-default"
              onClick={() => openSidebar('filters')}
              type="button"
            >
              <i className="icon-sliders"></i>
              Filters
            </button>
          </div>
        </div>
      </div>

      {isPlaceSearchVisible && (
        <div className="visible-xs-block panel panel-default search-map-place">
          <SearchPlaceInput
            onPlaceSearch={onPlaceSearch}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
          <button
            className="btn btn-action btn-primary visible-xs-block search-sidebar-close"
            onClick={() => setIsPlaceSearchVisible(false)}
            type="button"
          >
            Back to map
          </button>
        </div>
      )}

      {isUserPublic && (
        <div className="search-sidebar-toggle hidden-xs">
          <button
            aria-label={
              isSidebarOpen ? 'Hide search filters' : 'Open search filters'
            }
            className="btn btn-link"
            onClick={() => toggleSidebar()}
            title={isSidebarOpen ? 'Collapse side panel' : 'Open side panel'}
            type="button"
          >
            <i
              className={`hidden-xs ${
                isSidebarOpen ? 'icon-left' : 'icon-right'
              }`}
            ></i>
          </button>
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
            communityNote={communityNote}
            communityNotesEnabled={communityNotesEnabled}
            filters={filters}
            isLoadingOffer={isLoadingOffer}
            offer={offer}
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
            <div role="document" tabIndex="0">
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
          onCommunityNoteOpen={previewCommunityNote}
          onOfferClose={closeOffer}
          onOfferOpen={previewOffer}
        />
      </div>
    </section>
  );
}

SearchPage.propTypes = {
  user: PropTypes.object,
};
