import React, { useEffect, useState } from 'react';
import { Button } from '@trustroots/ui/Button';
import { useTranslation } from 'react-i18next';

import { getErrorResponse } from '@/modules/core/client/api/http-client';
import MemberSearchCard from '@/modules/users/client/components/MemberSearchCard.component';
import type { UserProfile } from '@/modules/users/client/types';
import * as tribesApi from '@/modules/tribes/client/api/tribes.api';
import type {
  CircleMemberGroups,
  DiscoveryMember,
  TribeSummary,
} from '@/modules/tribes/client/api/tribes.api';

type Props = {
  circle: TribeSummary;
  user: UserProfile;
};

const EMPTY_SECTIONS: CircleMemberGroups = {
  contacts: [],
  recommenders: [],
  active: [],
};

const TRANSIENT_RETRY_DELAY_MS = 250;

function isTransientError(error: unknown): boolean {
  const { status } = getErrorResponse(error) ?? {};
  if (status !== undefined) return [500, 502, 503, 504].includes(status);

  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }
  return ['ECONNABORTED', 'ECONNRESET', 'ETIMEDOUT', 'ERR_NETWORK'].includes(
    String(error.code),
  );
}

function withoutDuplicates(groups: CircleMemberGroups): CircleMemberGroups {
  const seen = new Set<string>();
  const uniqueMembers = (members: DiscoveryMember[]) =>
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
  t,
}: {
  title: string;
  subtitle: string;
  members: DiscoveryMember[];
  t: (key: string) => string;
}) {
  if (!members.length) return null;

  return (
    <section className="circle-member-section">
      <h3>{title}</h3>
      <p>{subtitle}</p>
      <ul className="list-unstyled">
        {members.map(member => (
          <li className="circle-member-row" key={member._id}>
            <div className="circle-discovery-card">
              <MemberSearchCard user={member} />
              {(member.activity || member.hosting) && (
                <div className="circle-discovery-card-meta">
                  {member.activity && (
                    <span data-testid="circle-member-activity">
                      {member.activity === 'today'
                        ? t('Active today')
                        : member.activity === 'week'
                          ? t('Active this week')
                          : member.activity === 'month'
                            ? t('Active this month')
                            : t('Active more than a month ago')}
                    </span>
                  )}
                  {member.hosting && (
                    <a
                      data-testid="circle-member-accommodation"
                      href={`/profile/${encodeURIComponent(member.username)}/accommodation`}
                    >
                      {t('Hosting')}
                    </a>
                  )}
                </div>
              )}
            </div>
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
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let finishRetryWait = () => {};
    setIsLoading(true);
    setHasError(false);
    setSections(EMPTY_SECTIONS);

    async function loadMembers() {
      try {
        let groups: CircleMemberGroups;
        try {
          groups = await tribesApi.listMembers(circle.slug);
        } catch (error) {
          if (!isMounted || !isTransientError(error)) throw error;
          await new Promise<void>(resolve => {
            finishRetryWait = resolve;
            retryTimer = setTimeout(resolve, TRANSIENT_RETRY_DELAY_MS);
          });
          if (!isMounted) return;
          groups = await tribesApi.listMembers(circle.slug);
        }
        if (isMounted) setSections(withoutDuplicates(groups));
      } catch {
        if (isMounted) setHasError(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadMembers();
    return () => {
      isMounted = false;
      clearTimeout(retryTimer);
      finishRetryWait();
    };
  }, [circle.slug, user._id, attempt]);

  return (
    <div className="circle-member-discovery container">
      <MemberSection
        title={t('Your contacts in this circle')}
        subtitle={t('People you already know on Trustroots')}
        members={sections.contacts}
        t={t}
      />
      <MemberSection
        title={t('People who recommend you')}
        subtitle={t('Members of this circle who recommend you')}
        members={sections.recommenders}
        t={t}
      />
      <MemberSection
        title={t('Other active members')}
        subtitle={t(
          'Members of this circle who have been active in the past month',
        )}
        members={sections.active}
        t={t}
      />
      {!isLoading && hasError && (
        <div className="circle-member-error" role="alert">
          <p>{t('Could not load circle members. Please try again.')}</p>
          <Button type="button" onClick={() => setAttempt(value => value + 1)}>
            {t('Try again')}
          </Button>
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
