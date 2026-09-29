import PropTypes from 'prop-types';
import React from 'react';
import { Tab, Tabs } from 'react-bootstrap';

import SearchPlaceInput from './SearchPlaceInput.component';
import SearchSidebarFilters from './SearchSidebarFilters.component';
import SearchSidebarResults from './SearchSidebarResults.component';

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
}) {
  return (
    <>
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
        justified
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
