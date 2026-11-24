import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@trustroots/ui/Input';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import TribesHeader from './TribesHeader';
import TribesList from './TribesList';
import TribesJoinTrustroots from './TribesJoinTrustroots';

import { circlesQuery, setCachedCircle } from '../api/circle-queries';
import type { MembershipUpdate } from '../api/tribes.api';
import type { UserProfile } from '@/modules/users/client/types';

export default function TribesPage({
  user,
  onMembershipUpdated,
}: {
  user?: UserProfile;
  onMembershipUpdated: (data: MembershipUpdate) => void;
}) {
  const { t } = useTranslation('circles') as { t: (key: string) => string };
  const queryClient = useQueryClient();
  const { data: tribes = [], isSuccess } = useQuery(circlesQuery(user?._id));
  const [filter, setFilter] = useState('');

  const handleMembershipUpdated = (data: MembershipUpdate) => {
    if (data.tribe) {
      setCachedCircle(queryClient, data.tribe);
    }
    onMembershipUpdated(data);
  };

  const query = filter.trim().toLowerCase();
  const matchingTribes = tribes.filter(
    tribe =>
      tribe.label.toLowerCase().includes(query) || tribe.slug.includes(query),
  );
  const sections = [
    {
      title: t('New circles'),
      tribes: matchingTribes.filter(tribe => tribe.new),
    },
    {
      title: t('More circles'),
      tribes: matchingTribes.filter(tribe => !tribe.new),
    },
  ];

  return (
    <>
      <TribesHeader isLoggedIn={!!user} />

      <section className="tw:page-container">
        <div className="tw:grid-row">
          <div className="tw:grid-col-12">
            <div className="tw:mb-[15px] tw:max-w-[360px]">
              <label htmlFor="circle-catalogue-filter">
                {t('Filter circles')}
              </label>
              <Input
                id="circle-catalogue-filter"
                type="search"
                value={filter}
                onChange={event => setFilter(event.target.value)}
              />
            </div>
            <div role="status">
              {query && isSuccess && !matchingTribes.length && (
                <p>{t('No circles match your filter.')}</p>
              )}
            </div>
            {sections
              .filter(section => section.tribes.length > 0)
              .map(section => (
                <section key={section.title}>
                  <h3>{section.title}</h3>
                  <TribesList
                    tribes={section.tribes}
                    user={user}
                    onMembershipUpdated={handleMembershipUpdated}
                  />
                </section>
              ))}
          </div>
        </div>

        {!user && <TribesJoinTrustroots />}
      </section>
    </>
  );
}
