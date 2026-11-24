import React from 'react';
import { Button } from '@trustroots/ui/Button';
import { useAnalytics, type SearchFilter } from '@trustroots/analytics/client';

import SearchFilterLanguage from './SearchFilterLanguage.component';
import SearchCirclesToggle from './SearchCirclesToggle.component';
import SearchMyCirclesToggle from './SearchMyCirclesToggle.component';
import SearchFilterSwitch from './SearchFilterSwitch.component';
import SearchTypesToggle from './SearchTypesToggle.component';
import type { VisibleMapCounts } from './SearchMap.component';
import { normalizeTypes, type SearchFilters } from '../utils/search-filters';

interface SearchSidebarFiltersProps {
  communityNotesEnabled: boolean;
  filters: SearchFilters;
  onCloseSidebar: () => void;
  onCommunityNotesToggle: () => void;
  onFiltersChange: (filters: Partial<SearchFilters>) => void;
  onlineInPast6Months: boolean;
  onOnlineInPast6MonthsChange: () => void;
  visibleMapCounts?: VisibleMapCounts;
}

export default function SearchSidebarFilters({
  communityNotesEnabled,
  filters,
  onCloseSidebar,
  onCommunityNotesToggle,
  onFiltersChange,
  onlineInPast6Months,
  onOnlineInPast6MonthsChange,
  visibleMapCounts,
}: SearchSidebarFiltersProps) {
  const { track } = useAnalytics();
  const connectionsOnly = filters.connectionsOnly === true;
  const volunteering = filters.volunteering === true;

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
          counts={visibleMapCounts}
          onChange={types =>
            changeFilters('types', {
              types,
              ...(!types.includes('host') ? { volunteering: false } : {}),
            })
          }
          types={filters.types}
        />
        <div className="form-group">
          <SearchFilterSwitch
            checked={volunteering}
            count={volunteering ? visibleMapCounts?.host : undefined}
            onChange={checked =>
              changeFilters('volunteering', {
                volunteering: checked,
                ...(checked
                  ? { types: normalizeTypes([...filters.types, 'host']) }
                  : {}),
              })
            }
          >
            Offers volunteering
          </SearchFilterSwitch>
        </div>
        <div className="form-group">
          <SearchFilterSwitch
            checked={communityNotesEnabled && !connectionsOnly}
            count={
              communityNotesEnabled && !connectionsOnly
                ? visibleMapCounts?.communityNotes
                : undefined
            }
            disabled={connectionsOnly}
            onChange={() => {
              track('search_filter_changed', { filter: 'community_notes' });
              onCommunityNotesToggle();
            }}
          >
            Community Notes <small className="text-muted">via Nostroots</small>
          </SearchFilterSwitch>
        </div>
      </div>

      <hr className="hr-gray hr-tight" />

      <div className="form-group">
        <SearchFilterSwitch
          checked={connectionsOnly}
          onChange={checked =>
            changeFilters('connections_only', { connectionsOnly: checked })
          }
        >
          My connections only
        </SearchFilterSwitch>
      </div>

      <hr className="hr-gray hr-tight" />

      <div aria-label="Filter by circles" role="group">
        <div className="tw:grid-row">
          <div className="tw:grid-col-6">
            <h4>Circles</h4>
          </div>
          <div className="tw:grid-col-6 text-right">
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

      <div className="form-group">
        <SearchFilterSwitch
          checked={onlineInPast6Months}
          onChange={() => {
            track('search_filter_changed', { filter: 'online_recently' });
            onOnlineInPast6MonthsChange();
          }}
        >
          Online in the past 6 months
        </SearchFilterSwitch>
      </div>

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
        className="tw:block tw:sm:hidden search-sidebar-close"
        onClick={onCloseSidebar}
        type="button"
      >
        Back to map
      </Button>
    </section>
  );
}
