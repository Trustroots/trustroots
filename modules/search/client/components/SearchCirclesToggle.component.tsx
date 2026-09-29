import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';

import { read as readCircles } from '@/modules/tribes/client/api/tribes.api';

interface SearchCircle {
  _id: string;
  label: string;
}

interface SearchCirclesToggleProps {
  selectedTribeIds: string[];
  onChange: (tribeIds: string[]) => void;
}

export default function SearchCirclesToggle({
  selectedTribeIds,
  onChange,
}: SearchCirclesToggleProps) {
  const [circles, setCircles] = useState<SearchCircle[]>([]);
  const [toggles, setToggles] = useState<Record<string, boolean>>({});

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
    const nextToggles: Record<string, boolean> = {};

    selectedTribeIds.forEach(tribeId => {
      nextToggles[tribeId] = true;
    });
    setToggles(nextToggles);
  }, [selectedTribeIds]);

  function handleToggle(tribeId: string, isActive: boolean) {
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
            <div className="toggle"></div>
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
