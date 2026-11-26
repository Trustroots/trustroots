import React from 'react';
import { useTranslation } from 'react-i18next';

import lazyMap from '@/modules/core/client/components/lazyMap';
import type { CircleLocation } from '@/modules/tribes/client/components/CircleLocationMap';
import type {
  ConnectionsDiscovery,
  MappedConnection,
} from '@/modules/tribes/client/api/tribes.api';
import { memberActivityLabel } from '@/modules/tribes/client/utils/memberActivityLabel';
import MemberSearchCard from '@/modules/users/client/components/MemberSearchCard.component';
import MemberIdentity from '@/modules/users/client/components/MemberIdentity';

const CircleLocationMap = lazyMap(
  () => import('@/modules/tribes/client/components/CircleLocationMap'),
);
const hostingColour = '#008269';
const meetingColour = '#b16a19';

function mapLocations(
  connections: MappedConnection[],
  colour: string,
  activity: string,
  linkLabel: string,
): CircleLocation[] {
  return connections.flatMap(member => {
    const [latitude, longitude] = member.location;
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
        id: member._id,
        name: member.displayName,
        latitude,
        longitude,
        details: [activity],
        markerColor: colour,
        popupHeading: <MemberIdentity user={member} size={36} />,
        link: {
          url: `/profile/${encodeURIComponent(member.username)}/accommodation`,
          label: linkLabel,
        },
      },
    ];
  });
}

export default function HomeConnections({
  connections,
}: {
  connections: ConnectionsDiscovery;
}) {
  const { t } = useTranslation('pages');

  const { recent, hosts, meetings = [] } = connections;
  const hostingLabel = t('Hosting');
  const meetingLabel = t('Happy to meet');
  const hostingPins = mapLocations(
    hosts,
    hostingColour,
    hostingLabel,
    t('View hosting offer'),
  );
  const meetingPins = mapLocations(
    meetings,
    meetingColour,
    meetingLabel,
    t('View meeting availability'),
  );
  const locations = [...hostingPins, ...meetingPins];
  if (!recent.length && !locations.length) return null;

  return (
    <>
      {locations.length > 0 && (
        <div className="home-hosting-map">
          <CircleLocationMap
            title={t('Connections on the map')}
            description={t(
              'Approximate locations of people you know who are hosting or happy to meet.',
            )}
            mapLabel={t('Approximate locations of your connections')}
            locations={locations}
            state="ready"
            loadingText={t('Loading connection locations')}
            emptyText={t('No connection locations to show')}
            errorText={t('Could not load connection locations')}
            countLabel={locations.length === 1 ? t('location') : t('locations')}
            headingAs="h2"
            className="circle-location-map-panel--brand home-member-panel"
            legend={
              <ul className="home-connections-map-legend">
                {hostingPins.length > 0 && (
                  <li>
                    <span
                      aria-hidden="true"
                      style={{ backgroundColor: hostingColour }}
                    />
                    {hostingLabel}
                  </li>
                )}
                {meetingPins.length > 0 && (
                  <li>
                    <span
                      aria-hidden="true"
                      style={{ backgroundColor: meetingColour }}
                    />
                    {meetingLabel}
                  </li>
                )}
              </ul>
            }
            viewKey="home-hosting-map-view"
          />
        </div>
      )}
      {recent.length > 0 && (
        <section
          className="home-recent-members home-member-panel"
          aria-labelledby="home-recent-people"
        >
          <h2 id="home-recent-people" className="web-section-heading">
            {t('People you know who were active recently')}
          </h2>
          <ul className="home-recent-member-list web-section-list list-unstyled">
            {recent.map(member => (
              <li className="home-recent-member" key={member._id}>
                <MemberSearchCard
                  user={member}
                  compact
                  activityLabel={memberActivityLabel(member.activity, t)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
