import React from 'react';
import SearchFilterSwitch from './SearchFilterSwitch.component';
import { normalizeTypes } from '../utils/search-filters';

export default function SearchTypesToggle({
  types,
  onChange,
  counts,
}: {
  types: Array<string | { id: string }>;
  onChange: (types: string[]) => void;
  counts?: { host?: number; meet?: number };
}) {
  const selected = normalizeTypes(types);
  return (
    <ul className="list-unstyled">
      {(['host', 'meet'] as const).map(type => (
        <li className="form-group" key={type}>
          <SearchFilterSwitch
            checked={selected.includes(type)}
            count={selected.includes(type) ? counts?.[type] : undefined}
            disabled={selected.length === 1 && selected.includes(type)}
            onChange={checked =>
              onChange(
                normalizeTypes(
                  checked
                    ? [...selected, type]
                    : selected.filter(value => value !== type),
                ),
              )
            }
          >
            {type === 'host' ? 'Hosts' : 'Meetings'}
          </SearchFilterSwitch>
        </li>
      ))}
    </ul>
  );
}
