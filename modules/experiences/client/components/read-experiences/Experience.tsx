// External dependencies
import { useTranslation } from 'react-i18next';
import { Button } from '@trustroots/ui/Button';

import React from 'react';
import './experience.css';

// Internal dependencies
import { DAYS_TO_REPLY } from '../../utils/constants';
import { getProfileExperiencesPath } from '@/modules/core/shared/navigation-links';
import { getGender } from '@/modules/core/client/utils/user_info';
import Avatar from '@/modules/users/client/components/Avatar.component';
import Meta from './Meta';
import TimeAgo from '@/modules/core/client/components/TimeAgo';
import UserLink from '@/modules/users/client/components/UserLink';
import type { Experience as ExperienceModel } from '../../../shared/experience';

export default function Experience({
  experience,
  onReceiverProfile,
}: {
  experience: ExperienceModel;
  onReceiverProfile: boolean;
}) {
  const { t } = useTranslation('experiences') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  const {
    _id,
    created,
    feedbackPublic,
    interactions,
    public: isPublicExperience,
    recommend,
    userFrom,
    userTo,
    response,
  } = experience;

  const createdDate = new Date(created);

  // Get how many days are left before experience will become public
  const getDaysLeft = (date: Date): number =>
    Math.max(
      0,
      DAYS_TO_REPLY -
        Math.round((Date.now() - date.getTime()) / 3600 / 24 / 1000),
    );

  // TODO use `onReceiverProfile` in conditions below instead of `feedbackPublic === undefined`
  return (
    <div className="panel panel-default" id={_id}>
      <div className="panel-body">
        <div className="experience-header">
          <Avatar user={userFrom} size={36} />
          <div className="experience-user-meta">
            <UserLink user={userFrom} className="experience-user-link" />
            <span className="muted">
              {userFrom?.gender && `${getGender(userFrom.gender)}. `}
              {userFrom?.created &&
                (t('Member since {{date, YYYY}}.', {
                  date: new Date(userFrom.created),
                }) as string)}
            </span>
          </div>
          <a
            className="experience-link"
            href={`/profile/${userTo.username}/experiences#${_id}`}
          >
            <TimeAgo date={createdDate} />
          </a>
        </div>
        {!isPublicExperience && feedbackPublic === undefined && (
          <>
            <div className="experience-pending-notice">
              <div
                className="experience-pending-placeholder"
                aria-hidden="true"
              >
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
                enim ad minim veniam, quis nostrud exercitation ullamco laboris
                nisi ut aliquip ex ea commodo consequat...
              </div>
              {
                t(
                  'You have {{count}} days left to respond before their experience will become public.',
                  { count: getDaysLeft(createdDate) },
                ) as string
              }
            </div>
            {userFrom?.username && (
              <p>
                <Button
                  intent="primary"
                  render={
                    <a href={getProfileExperiencesPath(userFrom.username)} />
                  }
                >
                  {t('Write about your experience with them') as string}
                </Button>
              </p>
            )}
          </>
        )}
        <Meta interactions={interactions} recommend={recommend} />
        {feedbackPublic && (
          <div className="experience-feedback-public">{feedbackPublic}</div>
        )}
        {response && (
          <div className="experience-response">
            <div className="experience-header">
              <Avatar user={userTo} size={24} />
              <UserLink user={userTo} className="experience-user-link" />
              (<TimeAgo date={new Date(response.created)} />)
            </div>
            <Meta
              interactions={response.interactions}
              recommend={response.recommend}
            />
            {response.feedbackPublic && (
              <div className="experience-feedback-public">
                {response.feedbackPublic}
              </div>
            )}
          </div>
        )}
        {!isPublicExperience && feedbackPublic !== undefined && (
          <>
            <div className="experience-pending-notice">
              {
                t(
                  'Your experience will become public in {{count}} days, or when they share their experience with you.',
                  { count: getDaysLeft(createdDate) },
                ) as string
              }
            </div>
          </>
        )}
      </div>
      {!response && isPublicExperience && onReceiverProfile && (
        <div className="panel-footer text-right">
          <Button
            render={<a href={getProfileExperiencesPath(userFrom.username)} />}
          >
            {t('Write about your experience') as string}
          </Button>
        </div>
      )}
    </div>
  );
}
