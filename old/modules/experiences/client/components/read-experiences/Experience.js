// External dependencies
import { useTranslation } from 'react-i18next';

import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';

// Internal dependencies
import { DAYS_TO_REPLY } from '../../utils/constants';
import { getGender } from '@/modules/core/client/utils/user_info';
import Avatar from '@/modules/users/client/components/Avatar.component';
import Meta from './Meta';
import TimeAgo from '@/modules/core/client/components/TimeAgo';
import UserLink from '@/modules/users/client/components/UserLink';
import { experienceType } from '@/modules/experiences/client/experiences.prop-types';

const PendingNotice = styled.div`
  font-style: italic;
  padding: 20px 0;
`;

const PendingNoticePlaceholder = styled.div`
  color: #ccc;
  filter: blur(4px);
  user-select: none;
  padding: 0 0 10px 0;
`;

const FeedbackPublic = styled.div`
  max-width: 600px;
`;

const Response = styled.div`
  border-top: 1px solid #ccc;
  margin: 20px 0 0 20px;
  padding: 20px 0 0 0;

  @media (max-width: 480px) {
    margin-left: 10px;
  }
`;

const Header = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap-reverse;
  line-height: 1.3em;

  .avatar {
    margin-right: 10px;
  }
`;

const UserMeta = styled.div`
  display: flex;
  flex-direction: column;
`;

const ExperienceLink = styled.a`
  align-self: start;
  margin-left: auto;
  color: #333;

  @media (max-width: 480px) {
    width: 100%;
    margin-left: 0;
    margin-bottom: 10px;
  }
`;

const UserLinkStyled = styled(UserLink)`
  font-weight: bold;
  margin-right: 5px;
`;

export default function Experience({ experience, onReceiverProfile }) {
  const { t } = useTranslation('experiences');

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
  const getDaysLeft = date =>
    Math.max(
      0,
      DAYS_TO_REPLY -
        Math.round((Date.now() - date.getTime()) / 3600 / 24 / 1000),
    );

  // TODO use `onReceiverProfile` in conditions below instead of `feedbackPublic === undefined`
  return (
    <div className="panel panel-default" id={_id}>
      <div className="panel-body">
        <Header>
          <Avatar user={userFrom} size={36} />
          <UserMeta>
            <UserLinkStyled user={userFrom} />
            <span className="muted">
              {userFrom?.gender && `${getGender(userFrom.gender)}. `}
              {userFrom?.created &&
                t('Member since {{date, YYYY}}.', {
                  date: new Date(userFrom.created),
                })}
            </span>
          </UserMeta>
          <ExperienceLink
            href={`/profile/${userTo.username}/experiences#${_id}`}
          >
            <TimeAgo date={createdDate} />
          </ExperienceLink>
        </Header>
        {!isPublicExperience && feedbackPublic === undefined && (
          <>
            <PendingNotice>
              <PendingNoticePlaceholder aria-hidden="true">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
                enim ad minim veniam, quis nostrud exercitation ullamco laboris
                nisi ut aliquip ex ea commodo consequat...
              </PendingNoticePlaceholder>
              {t(
                'You have {{count}} days left to respond before their experience will become public.',
                { count: getDaysLeft(createdDate) },
              )}
            </PendingNotice>
            {userFrom?.username && (
              <p>
                <a
                  className="btn btn-primary"
                  href={`/profile/${userFrom.username}/experiences/new`}
                >
                  {t('Write about your experience with them')}
                </a>
              </p>
            )}
          </>
        )}
        <Meta interactions={interactions} recommend={recommend} />
        {feedbackPublic && <FeedbackPublic>{feedbackPublic}</FeedbackPublic>}
        {response && (
          <Response>
            <Header>
              <Avatar user={userTo} size={24} />
              <UserLinkStyled user={userTo} />
              (<TimeAgo date={new Date(response.created)} />)
            </Header>
            <Meta
              interactions={response.interactions}
              recommend={response.recommend}
            />
            {response.feedbackPublic && (
              <FeedbackPublic>{response.feedbackPublic}</FeedbackPublic>
            )}
          </Response>
        )}
        {!isPublicExperience && feedbackPublic !== undefined && (
          <>
            <PendingNotice>
              {t(
                'Your experience will become public in {{count}} days, or when they share their experience with you.',
                { count: getDaysLeft(createdDate) },
              )}
            </PendingNotice>
          </>
        )}
      </div>
      {!response && isPublicExperience && onReceiverProfile && (
        <div className="panel-footer text-right">
          <a
            href={`/profile/${userFrom.username}/experiences/new`}
            className="btn btn-default"
          >
            {t('Write about your experience')}
          </a>
        </div>
      )}
    </div>
  );
}

Experience.propTypes = {
  experience: experienceType.isRequired,
  onReceiverProfile: PropTypes.bool.isRequired,
};
