import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';

import { read as readCircles } from '@/modules/tribes/client/api/tribes.api';

export default function SearchCirclesToggle({ selectedTribeIds, onChange }) {
  const [circles, setCircles] = useState([]);
  const [toggles, setToggles] = useState({});

  useEffect(() => {
    let isMounted = true;

    readCircles()
      .then(data => {
        if (isMounted) {
          setCircles(data || []);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCircles([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const nextToggles = {};

    selectedTribeIds.forEach(tribeId => {
      nextToggles[tribeId] = true;
    });
    setToggles(nextToggles);
  }, [selectedTribeIds]);

  function handleToggle(tribeId, isActive) {
    const nextToggles = {
      ...toggles,
      [tribeId]: isActive,
    };
    setToggles(nextToggles);
    onChange(
      Object.entries(nextToggles)
        .filter(([, active]) => active)
        .map(([tribeId]) => tribeId),
    );
  }

  if (!circles.length) {
    return null;
  }

  return (
    <ul className="list-unstyled row">
      {circles.map(circle => (
        <li className="form-group col-xs-12 col-sm-6 col-md-4" key={circle._id}>
          <label className="tr-switch tr-switch-side-left tr-switch-sm">
            <input
              checked={Boolean(toggles[circle._id])}
              onChange={({ target: { checked } }) =>
                handleToggle(circle._id, checked)
              }
              type="checkbox"
            />
            {circle.label}
          </label>
        </li>
      ))}
    </ul>
  );
}

SearchCirclesToggle.propTypes = {
  onChange: PropTypes.func.isRequired,
  selectedTribeIds: PropTypes.arrayOf(PropTypes.string).isRequired,
};
