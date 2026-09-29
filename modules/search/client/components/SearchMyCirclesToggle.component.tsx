import React, { useEffect, useState } from 'react';

import { listMemberships } from '@/modules/tribes/client/api/tribes.api';

interface SearchMyCirclesToggleProps {
  selectedTribeIds: string[];
  onChange: (tribeIds: string[]) => void;
}

export default function SearchMyCirclesToggle({
  selectedTribeIds,
  onChange,
}: SearchMyCirclesToggleProps) {
  const [userTribeIds, setUserTribeIds] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    let isMounted = true;

    listMemberships()
      .then(memberships => {
        if (!isMounted) {
          return;
        }

        const tribeIds = (memberships || [])
          .map((membership: { tribe?: { _id?: string } }) => membership.tribe?._id)
          .filter((id: unknown): id is string => Boolean(id));
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
      !selectedTribeIds.every((id: string) => userTribeIds.includes(id))
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
