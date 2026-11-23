import React, { useId } from 'react';
import { Button } from '@trustroots/ui/Button';
import { Select } from '@trustroots/ui/Select';
import type { PlaceHostSort } from '@/modules/offers/shared/offer';
import type useCityHosts from '../hooks/use-city-hosts';
import type { CitySearch } from '../utils/location';

export interface CityResults {
  city: CitySearch;
  active: boolean;
  onViewChange: (active: boolean) => void;
  sort: PlaceHostSort;
  onSortChange: (sort: PlaceHostSort) => void;
  canHost: boolean;
  onCanHostChange: (canHost: boolean) => void;
  onlyRecent: boolean;
  onToggleRecent: () => void;
  query: ReturnType<typeof useCityHosts>;
  onSelectHost: (id: string) => void;
  offerError: boolean;
}

export default function CityHostControls({
  city,
  active,
  onViewChange,
  sort,
  onSortChange,
  canHost,
  onCanHostChange,
  onlyRecent,
  onToggleRecent,
}: CityResults) {
  const sortId = useId();
  return (
    <div className="tw:mx-2.5 tw:mb-3 tw:grid tw:gap-2">
      {active && <h2 className="tw:m-0 tw:text-lg">Hosts in {city.name}</h2>}
      <Button
        type="button"
        onClick={() => onViewChange(!active)}
        className="tw:justify-self-start"
      >
        {active ? 'Results in this map area' : `Hosts in ${city.name}`}
      </Button>
      {active && (
        <>
          <label className="tw:grid tw:gap-1 tw:text-text!" htmlFor={sortId}>
            Sort hosts
            <Select
              id={sortId}
              value={sort}
              onChange={event =>
                onSortChange(event.target.value as PlaceHostSort)
              }
            >
              <option value="name">Name</option>
              <option value="activity">Most recently active</option>
              <option value="experiences">Most public Experiences</option>
            </Select>
          </label>
          <label className="tw:flex tw:items-center tw:gap-2 tw:text-text!">
            <input
              type="checkbox"
              checked={canHost}
              onChange={event => onCanHostChange(event.target.checked)}
            />
            Can host only
          </label>
          <label className="tw:flex tw:items-center tw:gap-2 tw:text-text!">
            <input
              type="checkbox"
              checked={onlyRecent}
              onChange={onToggleRecent}
            />
            Active in the past six months
          </label>
        </>
      )}
    </div>
  );
}
