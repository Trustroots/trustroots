import React, { useEffect, useState } from 'react';
import { Button } from '@trustroots/ui/Button';
import { useTranslation } from 'react-i18next';

import ContentState from '@/modules/core/client/components/ContentState';
import { getErrorResponse } from '@trustroots/core/http-client';
import MemberSearchCard from '@/modules/users/client/components/MemberSearchCard.component';
import type { UserProfile } from '@/modules/users/client/types';
import * as tribesApi from '@/modules/tribes/client/api/tribes.api';
import type {
  CircleMemberGroups,
  DiscoveryMember,
  TribeSummary,
} from '@/modules/tribes/client/api/tribes.api';
import { memberActivityLabel } from '@/modules/tribes/client/utils/memberActivityLabel';

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
      <h3 className="web-section-heading">{title}</h3>
      <p className="web-section-description">{subtitle}</p>
      <ul className="web-section-list list-unstyled">
        {members.map(member => (
          <li className="circle-member-row" key={member._id}>
            <MemberSearchCard
              user={member}
              compact
              activityLabel={
                member.activity && memberActivityLabel(member.activity, t)
              }
              action={
                member.hosting && (
                  <Button
                    variant="soft"
                    intent="primary"
                    size="xs"
                    render={
                      <a
                        href={`/profile/${encodeURIComponent(member.username)}/accommodation`}
                      />
                    }
                  >
                    {t('Hosting')}
                  </Button>
                )
              }
            />
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
    <div className="circle-member-discovery tw:page-container">
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
      {isLoading && (
        <ContentState
          kind="loading"
          heading={t('Loading circle members…')}
          description={t('Please wait while we find members of this circle.')}
        />
      )}
      {!isLoading && hasError && (
        <ContentState
          className="circle-member-error"
          kind="error"
          heading={t('Circle members unavailable')}
          description={t('Could not load circle members. Please try again.')}
          action={
            <Button
              type="button"
              onClick={() => setAttempt(value => value + 1)}
            >
              {t('Try again')}
            </Button>
          }
        />
      )}
      {!isLoading &&
        !hasError &&
        !sections.contacts.length &&
        !sections.recommenders.length &&
        !sections.active.length && (
          <ContentState
            className="circle-member-empty"
            kind="empty"
            heading={t('No members to show yet')}
            description={t('Members may appear here as this circle grows.')}
          />
        )}
    </div>
  );
}
