import PropTypes from 'prop-types';
import React from 'react';
import * as ReactBootstrap from 'react-bootstrap';

import SearchPlaceInput from './SearchPlaceInput.component';
import SearchSidebarFilters from './SearchSidebarFilters.component';
import SearchSidebarResults, {
  type SearchResultOffer,
} from './SearchSidebarResults.component';
import type { SearchFilters } from '../utils/search-filters';

interface SearchCommunityNoteSummary {
  notes: import('nostr-tools').Event[];
  plusCode: string | null;
}

interface SearchSidebarProps {
  activeTab: 'filters' | 'results';
  communityNote?: SearchCommunityNoteSummary | null;
  communityNotesEnabled: boolean;
  filters: SearchFilters;
  isLoadingOffer?: boolean;
  offer?: SearchResultOffer | null;
  onCloseSidebar: () => void;
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
  communityNote,
  communityNotesEnabled,
  filters,
  isLoadingOffer,
  offer,
  onCloseSidebar,
  onCommunityNotesToggle,
  onFiltersChange,
  onPlaceSearch,
  onTabSelect,
  onlineInPast6Months,
  onOnlineInPast6MonthsChange,
  searchQuery,
  setSearchQuery,
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
            onCloseSidebar={onCloseSidebar}
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
          <SearchSidebarResults
            communityNote={communityNote}
            isLoadingOffer={isLoadingOffer}
            offer={offer}
            onCloseSidebar={onCloseSidebar}
          />
        </Tab>
      </Tabs>
    </>
  );
}

SearchSidebar.propTypes = {
  activeTab: PropTypes.oneOf(['filters', 'results']).isRequired,
  communityNote: PropTypes.object,
  communityNotesEnabled: PropTypes.bool.isRequired,
  filters: PropTypes.object.isRequired,
  isLoadingOffer: PropTypes.bool,
  offer: PropTypes.object,
  onCloseSidebar: PropTypes.func.isRequired,
  onCommunityNotesToggle: PropTypes.func.isRequired,
  onFiltersChange: PropTypes.func.isRequired,
  onPlaceSearch: PropTypes.func.isRequired,
  onTabSelect: PropTypes.func.isRequired,
  onlineInPast6Months: PropTypes.bool.isRequired,
  onOnlineInPast6MonthsChange: PropTypes.func.isRequired,
  searchQuery: PropTypes.string.isRequired,
  setSearchQuery: PropTypes.func.isRequired,
};
