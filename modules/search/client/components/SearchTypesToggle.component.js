import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';

import { normalizeTypes } from '../utils/search-filters';

export default function SearchTypesToggle({ types, onChange }) {
  const [hostsEnabled, setHostsEnabled] = useState(
    normalizeTypes(types).includes('host'),
  );

  useEffect(() => {
    setHostsEnabled(normalizeTypes(types).includes('host'));
  }, [types]);

  return (
    <ul className="list-unstyled">
      <li className="form-group">
        <label className="tr-switch tr-switch-side-left">
          <input
            checked={hostsEnabled}
            onChange={() => {
              const nextTypes = hostsEnabled ? ['meet'] : ['host', 'meet'];
              setHostsEnabled(!hostsEnabled);
              onChange(nextTypes);
            }}
            type="checkbox"
          />
          Hosts
        </label>
      </li>
    </ul>
  );
}

SearchTypesToggle.propTypes = {
  onChange: PropTypes.func.isRequired,
  types: PropTypes.arrayOf(PropTypes.string).isRequired,
};
