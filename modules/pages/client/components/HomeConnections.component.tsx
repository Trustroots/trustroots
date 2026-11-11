import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import CircleLocationMap, {
  type CircleLocation,
} from '@/modules/tribes/client/components/CircleLocationMap';
import * as tribesApi from '@/modules/tribes/client/api/tribes.api';
import type { ConnectionsDiscovery } from '@/modules/tribes/client/api/tribes.api';
import MemberSearchCard from '@/modules/users/client/components/MemberSearchCard.component';

const EMPTY_CONNECTIONS: ConnectionsDiscovery = { recent: [], hosts: [] };

function hostingLocations(
  hosts: ConnectionsDiscovery['hosts'],
  t: (key: string) => string,
): CircleLocation[] {
  return hosts.flatMap(host => {
    const [latitude, longitude] = host.location;
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 85 ||
      Math.abs(longitude) > 180
    ) {
      return [];
    }
    return [
      {
        id: host._id,
        name: host.displayName,
        latitude,
        longitude,
        details: [],
        link: {
          url: `/profile/${encodeURIComponent(host.username)}/accommodation`,
          label: t('View hosting offer'),
        },
      },
    ];
  });
}

export default function HomeConnections() {
  const { t } = useTranslation('pages');
  const [connections, setConnections] = useState(EMPTY_CONNECTIONS);

  useEffect(() => {
    let active = true;
    tribesApi
      .getConnections()
      .then(result => {
        if (active) setConnections(result);
      })
      .catch(() => {
        if (active) setConnections(EMPTY_CONNECTIONS);
      });
    return () => {
      active = false;
    };
  }, []);

  const { recent } = connections;
  const locations = hostingLocations(connections.hosts, t);
  if (!recent.length && !locations.length) return null;

  return (
    <section className="home-connections container">
      {recent.length > 0 && (
        <div className="home-recent-members">
          <h2>{t('People you know who were active recently')}</h2>
          <ul className="home-recent-member-list list-unstyled">
            {recent.map(member => (
              <li className="home-recent-member" key={member._id}>
                <MemberSearchCard
                  user={member}
                  compact
                  activityLabel={
                    member.activity === 'today'
                      ? t('Active today')
                      : member.activity === 'week'
                        ? t('Active this week')
                        : t('Active this month')
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      )}
      {locations.length > 0 && (
        <div className="home-hosting-map">
          <CircleLocationMap
            title={t('Connections who are hosting')}
            description={t(
              'Approximate locations of people you know who are currently hosting.',
            )}
            mapLabel={t('Approximate hosting locations of your connections')}
            locations={locations}
            state="ready"
            loadingText={t('Loading hosting locations')}
            emptyText={t('No hosting locations to show')}
            errorText={t('Could not load hosting locations')}
            countLabel={t('hosting locations')}
            viewKey="home-hosting-map-view"
          />
        </div>
      )}
    </section>
  );
}
