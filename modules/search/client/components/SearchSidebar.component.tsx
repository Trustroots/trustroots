import React from 'react';
import * as ReactBootstrap from 'react-bootstrap';

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
  onTabSelect: (tab: string | null) => void;
  onlineInPast6Months: boolean;
  onOnlineInPast6MonthsChange: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

interface TabProps {
  children: React.ReactNode;
  'aria-label'?: string;
  eventKey: string;
  title: React.ReactNode;
}

interface TabsProps {
  children: React.ReactNode;
  activeKey: string;
  className: string;
  id: string;
  justify: boolean;
  onSelect: (key: string | null) => void;
}

const { Tab, Tabs } = ReactBootstrap as unknown as {
  Tab: React.ComponentType<TabProps>;
  Tabs: React.ComponentType<TabsProps>;
};

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
        <a className="btn btn-default btn-block" href="/search/members">
          <i className="icon-users" aria-hidden="true" /> Find members by name
          or location
        </a>
      </div>
      <div className="search-sidebar-section hidden-xs">
        <SearchPlaceInput
          onPlaceSearch={onPlaceSearch}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      </div>

      <Tabs
        activeKey={activeTab}
        className="search-sidebar-tabs"
        id="search-sidebar-tabs"
        justify
        onSelect={onTabSelect}
      >
        <Tab
          aria-label={`Search filters${
            activeTab === 'filters' ? ' (active now)' : ''
          }`}
          eventKey="filters"
          title={
            <span>
              <i className="icon-sliders"></i> Filters
            </span>
          }
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
        </Tab>
        <Tab
          aria-label={`Selected search results${
            activeTab === 'results' ? ' (active now)' : ''
          }`}
          eventKey="results"
          title="Results"
        >
          <SearchSidebarResults {...resultsProps} />
        </Tab>
      </Tabs>
    </>
  );
}
