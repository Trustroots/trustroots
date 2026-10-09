import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Avatar from '@/modules/users/client/components/Avatar.component';
import UserLink from '@/modules/users/client/components/UserLink';
import * as tribesApi from '@/modules/tribes/client/api/tribes.api';
import type {
  CircleMemberGroups,
  TribeSummary,
} from '@/modules/tribes/client/api/tribes.api';
import type { UserProfile } from '@/modules/users/client/types';

type Props = {
  circle: TribeSummary;
  user: UserProfile;
};

const EMPTY_SECTIONS: CircleMemberGroups = {
  contacts: [],
  recommenders: [],
  active: [],
};

function withoutDuplicates(groups: CircleMemberGroups): CircleMemberGroups {
  const seen = new Set<string>();
  const uniqueMembers = (members: UserProfile[]) =>
    members.filter(member => {
      if (seen.has(member._id)) return false;
      seen.add(member._id);
      return true;
    });
  return {
    contacts: uniqueMembers(groups.contacts),
    recommenders: uniqueMembers(groups.recommenders),
    active: uniqueMembers(groups.active),
  };
}

function MemberSection({
  title,
  subtitle,
  members,
}: {
  title: string;
  subtitle: string;
  members: UserProfile[];
}) {
  if (!members.length) return null;

  return (
    <section className="circle-member-section">
      <h3>{title}</h3>
      <p>{subtitle}</p>
      <ul className="list-unstyled">
        {members.map(member => (
          <li className="circle-member-row" key={member._id}>
            <Avatar user={member} size={64} />
            <UserLink className="circle-member-link" user={member} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function CircleMemberDiscovery({ circle, user }: Props) {
  const { t } = useTranslation('circles') as {
    t: (key: string) => string;
  };
  const [sections, setSections] = useState(EMPTY_SECTIONS);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setHasError(false);
    setSections(EMPTY_SECTIONS);
    tribesApi
      .listMembers(circle.slug)
      .then(groups => {
        if (isMounted) setSections(withoutDuplicates(groups));
      })
      .catch(() => {
        if (isMounted) setHasError(true);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [circle.slug, user._id, attempt]);

  return (
    <div className="circle-member-discovery container">
      <MemberSection
        title={t('Your contacts in this circle')}
        subtitle={t('People you already know on Trustroots')}
        members={sections.contacts}
      />
      <MemberSection
        title={t('People who recommend you')}
        subtitle={t('Members of this circle who recommend you')}
        members={sections.recommenders}
      />
      <MemberSection
        title={t('Other active members')}
        subtitle={t(
          'Members of this circle who have been active in the past month',
        )}
        members={sections.active}
      />
      {!isLoading && hasError && (
        <div className="circle-member-error" role="alert">
          <p>{t('Could not load circle members. Please try again.')}</p>
          <button
            type="button"
            className="btn btn-default"
            onClick={() => setAttempt(value => value + 1)}
          >
            {t('Try again')}
          </button>
        </div>
      )}
      {!isLoading &&
        !hasError &&
        !sections.contacts.length &&
        !sections.recommenders.length &&
        !sections.active.length && (
          <p className="circle-member-empty">{t('No members to show yet')}</p>
        )}
    </div>
  );
}
