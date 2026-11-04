import React from 'react';
import { Button } from '@trustroots/ui/Button';
import { useAnalytics, type SearchFilter } from '@trustroots/analytics/client';

import SearchFilterLanguage from './SearchFilterLanguage.component';
import SearchCirclesToggle from './SearchCirclesToggle.component';
import SearchMyCirclesToggle from './SearchMyCirclesToggle.component';
import SearchTypesToggle from './SearchTypesToggle.component';
import type { SearchFilters } from '../utils/search-filters';

interface SearchSidebarFiltersProps {
  communityNotesEnabled: boolean;
  filters: SearchFilters;
  onCloseSidebar: () => void;
  onCommunityNotesToggle: () => void;
  onFiltersChange: (filters: Partial<SearchFilters>) => void;
  onlineInPast6Months: boolean;
  onOnlineInPast6MonthsChange: () => void;
}

export default function SearchSidebarFilters({
  communityNotesEnabled,
  filters,
  onCloseSidebar,
  onCommunityNotesToggle,
  onFiltersChange,
  onlineInPast6Months,
  onOnlineInPast6MonthsChange,
}: SearchSidebarFiltersProps) {
  const { track } = useAnalytics();

  function changeFilters(
    filter: SearchFilter,
    changes: Partial<SearchFilters>,
  ) {
    track('search_filter_changed', { filter });
    onFiltersChange(changes);
  }

  return (
    <section className="search-sidebar-section search-sidebar-filters">
      <div aria-label="Map content" role="group">
        <h4>Map content</h4>
        <SearchTypesToggle
          onChange={types => changeFilters('types', { types })}
          types={filters.types}
        />
        <p>
          <label className="tr-switch">
            <input
              checked={communityNotesEnabled}
              onChange={() => {
                track('search_filter_changed', { filter: 'community_notes' });
                onCommunityNotesToggle();
              }}
              type="checkbox"
            />
            <div className="toggle"></div>
            Community Notes <small className="text-muted">via Nostroots</small>
          </label>
        </p>
      </div>

      <hr className="hr-gray hr-tight" />

      <div aria-label="Filter by circles" role="group">
        <div className="row">
          <div className="col-xs-6">
            <h4>Circles</h4>
          </div>
          <div className="col-xs-6 text-right">
            <Button
              className="search-sidebar-filters-clear"
              disabled={!filters.tribes.length}
              onClick={() => onFiltersChange({ tribes: [] })}
              type="button"
            >
              Clear circles
            </Button>
          </div>
        </div>

        <SearchMyCirclesToggle
          onChange={tribes => changeFilters('my_circles', { tribes })}
          selectedTribeIds={filters.tribes}
        />
        <SearchCirclesToggle
          onChange={tribes => changeFilters('circles', { tribes })}
          selectedTribeIds={filters.tribes}
        />
      </div>

      <hr className="hr-gray hr-tight" />

      <p>
        <label className="tr-switch">
          <input
            checked={onlineInPast6Months}
            onChange={() => {
              track('search_filter_changed', { filter: 'online_recently' });
              onOnlineInPast6MonthsChange();
            }}
            type="checkbox"
          />
          <div className="toggle"></div>
          Online in the past 6 months
        </label>
      </p>

      <hr className="hr-gray hr-tight" />

      <SearchFilterLanguage
        onChangeLanguages={languages =>
          changeFilters('languages', { languages })
        }
        preSelectedLanguages={filters.languages}
      />

      <Button
        intent="primary"
        size="xl"
        className="visible-xs-block search-sidebar-close"
        onClick={onCloseSidebar}
        type="button"
      >
        Back to map
      </Button>
    </section>
  );
}
