import axios from 'axios';
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';

async function fetchMemberships() {
  const { data } = await axios.get('/api/users/memberships');
  return data;
}

export default function SearchMyCirclesToggle({ selectedTribeIds, onChange }) {
  const [userTribeIds, setUserTribeIds] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    let isMounted = true;

    fetchMemberships()
      .then(memberships => {
        if (!isMounted) {
          return;
        }

        const tribeIds = (memberships || [])
          .map(membership => membership.tribe?._id)
          .filter(Boolean);
        setUserTribeIds(tribeIds);
      })
      .finally(() => {
        if (isMounted) {
          setIsInitialized(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (
      isEnabled &&
      selectedTribeIds.length &&
      !selectedTribeIds.every(id => userTribeIds.includes(id))
    ) {
      setIsEnabled(false);
    }
  }, [isEnabled, selectedTribeIds, userTribeIds]);

  if (!isInitialized) {
    return null;
  }

  if (!userTribeIds.length) {
    return (
      <p className="help-block">
        <span className="icon-right"></span>
        <a className="text-muted" href="/circles">
          Join circles to find similar members
        </a>
      </p>
    );
  }

  const label =
    userTribeIds.length === 1
      ? 'Show only members from my circle'
      : 'Show only members from my circles';

  return (
    <div className="form-group">
      <label className="tr-switch">
        <input
          checked={isEnabled}
          onChange={() => {
            const nextEnabled = !isEnabled;
            setIsEnabled(nextEnabled);

            if (nextEnabled) {
              onChange(userTribeIds);
            }
          }}
          type="checkbox"
        />
        <div className="toggle"></div>
        {label}
      </label>
    </div>
  );
}

SearchMyCirclesToggle.propTypes = {
  onChange: PropTypes.func.isRequired,
  selectedTribeIds: PropTypes.arrayOf(PropTypes.string).isRequired,
};
