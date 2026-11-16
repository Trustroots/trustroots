// External dependencies
import { useTranslation } from 'react-i18next';
import { Button } from '@trustroots/ui/Button';

import React from 'react';

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
        <div className="tw:flex tw:flex-wrap-reverse tw:items-center tw:leading-[1.3em] tw:[&_.avatar]:me-2.5">
          <Avatar user={userFrom} size={36} />
          <div className="tw:flex tw:flex-col">
            <UserLink user={userFrom} className="tw:me-[5px] tw:font-bold" />
            <span className="muted">
              {userFrom?.gender && `${getGender(userFrom.gender)}. `}
              {userFrom?.created &&
                (t('Member since {{date, YYYY}}.', {
                  date: new Date(userFrom.created),
                }) as string)}
            </span>
          </div>
          <a
            className="tw:ms-auto tw:[align-self:start] tw:text-[#333] tw:[@media(max-width:480px)]:ms-0 tw:[@media(max-width:480px)]:mb-2.5 tw:[@media(max-width:480px)]:w-full"
            href={`/profile/${userTo.username}/experiences#${_id}`}
          >
            <TimeAgo date={createdDate} />
          </a>
        </div>
        {!isPublicExperience && feedbackPublic === undefined && (
          <>
            <div className="tw:py-5 tw:italic">
              <div
                className="tw:pb-2.5 tw:text-[#ccc] tw:blur-[4px] tw:select-none"
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
          <div className="tw:max-w-[600px]">{feedbackPublic}</div>
        )}
        {response && (
          <div className="tw:ms-5 tw:mt-5 tw:[border-top:1px_solid_#ccc] tw:pt-5 tw:[@media(max-width:480px)]:ms-2.5">
            <div className="tw:flex tw:flex-wrap-reverse tw:items-center tw:leading-[1.3em] tw:[&_.avatar]:me-2.5">
              <Avatar user={userTo} size={24} />
              <UserLink user={userTo} className="tw:me-[5px] tw:font-bold" />
              (<TimeAgo date={new Date(response.created)} />)
            </div>
            <Meta
              interactions={response.interactions}
              recommend={response.recommend}
            />
            {response.feedbackPublic && (
              <div className="tw:max-w-[600px]">{response.feedbackPublic}</div>
            )}
          </div>
        )}
        {!isPublicExperience && feedbackPublic !== undefined && (
          <>
            <div className="tw:py-5 tw:italic">
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
