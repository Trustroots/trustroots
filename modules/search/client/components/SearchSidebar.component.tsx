import React from 'react';
import { Button } from '@trustroots/ui/Button';
import { Tab, Tabs, TabsList, TabsPanel } from '@trustroots/ui/Tabs';

import SearchPlaceInput from './SearchPlaceInput.component';
import SearchSidebarFilters from './SearchSidebarFilters.component';
import SearchSidebarResults from './SearchSidebarResults.component';
import type { SearchFilters } from '../utils/search-filters';

type SearchSidebarResultsPassthrough = Pick<
  React.ComponentProps<typeof SearchSidebarResults>,
  | 'communityNote'
  | 'communityNoteThreads'
  | 'isLoadingOffer'
  | 'isLoadingOffers'
  | 'offer'
  | 'offers'
  | 'onBackToOffers'
  | 'onCloseSidebar'
  | 'onCommunityNoteSelect'
  | 'onOfferSelect'
>;

interface SearchSidebarProps extends SearchSidebarResultsPassthrough {
  activeTab: 'filters' | 'results';
  communityNotesEnabled: boolean;
  filters: SearchFilters;
  onCommunityNotesToggle: () => void;
  onFiltersChange: (filters: Partial<SearchFilters>) => void;
  onPlaceSearch: (
    data:
      | import('../utils/location').MapBounds
      | import('../utils/location').MapPoint,
    type: 'center' | 'bounds',
  ) => void;
  onTabSelect: (tab: 'filters' | 'results') => void;
  onlineInPast6Months: boolean;
  onOnlineInPast6MonthsChange: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export default function SearchSidebar({
  activeTab,
  communityNotesEnabled,
  filters,
  onCommunityNotesToggle,
  onFiltersChange,
  onPlaceSearch,
  onTabSelect,
  onlineInPast6Months,
  onOnlineInPast6MonthsChange,
  searchQuery,
  setSearchQuery,
  ...resultsProps
}: SearchSidebarProps) {
  return (
    <>
      <div className="search-sidebar-section">
        <Button
          className="tw:block tw:w-full"
          render={<a href="/search/members" />}
        >
          <i className="icon-users" aria-hidden="true" /> Find members by name
          or location
        </Button>
      </div>
      <div className="search-sidebar-section hidden-xs">
        <SearchPlaceInput
          onPlaceSearch={onPlaceSearch}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      </div>

      <Tabs value={activeTab} onValueChange={onTabSelect}>
        <TabsList variant="tabs" justified className="search-sidebar-tabs">
          <Tab value="filters">
            <span>
              <i className="icon-sliders"></i> Filters
            </span>
          </Tab>
          <Tab value="results">Results</Tab>
        </TabsList>
        <TabsPanel
          aria-label={`Search filters${
            activeTab === 'filters' ? ' (active now)' : ''
          }`}
          value="filters"
        >
          <SearchSidebarFilters
            communityNotesEnabled={communityNotesEnabled}
            filters={filters}
            onCloseSidebar={resultsProps.onCloseSidebar}
            onCommunityNotesToggle={onCommunityNotesToggle}
            onFiltersChange={onFiltersChange}
            onlineInPast6Months={onlineInPast6Months}
            onOnlineInPast6MonthsChange={onOnlineInPast6MonthsChange}
          />
        </TabsPanel>
        <TabsPanel
          aria-label={`Selected search results${
            activeTab === 'results' ? ' (active now)' : ''
          }`}
          value="results"
        >
          <SearchSidebarResults {...resultsProps} />
        </TabsPanel>
      </Tabs>
    </>
  );
}
