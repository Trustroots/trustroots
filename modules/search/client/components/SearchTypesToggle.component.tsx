import React from 'react';
import { normalizeTypes } from '../utils/search-filters';

export default function SearchTypesToggle({
  types,
  onChange,
}: {
  types: Array<string | { id: string }>;
  onChange: (types: string[]) => void;
}) {
  const selected = normalizeTypes(types);
  return (
    <ul className="list-unstyled">
      {(['host', 'meet'] as const).map(type => (
        <li className="form-group" key={type}>
          <label className="tr-switch tr-switch-side-left">
            <input
              checked={selected.includes(type)}
              disabled={selected.length === 1 && selected.includes(type)}
              onChange={() =>
                onChange(
                  normalizeTypes(
                    selected.includes(type)
                      ? selected.filter(value => value !== type)
                      : [...selected, type],
                  ),
                )
              }
              type="checkbox"
            />
            <div className="toggle"></div>
            {type === 'host' ? 'Hosts' : 'Meetings'}
          </label>
        </li>
      ))}
    </ul>
  );
}
