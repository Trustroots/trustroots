// External dependencies
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

// Internal dependencies
import Avatar from '@/modules/users/client/components/Avatar.component';
import TimeAgo from '@/modules/core/client/components/TimeAgo';
import UserLink from '@/modules/users/client/components/UserLink';
import Recommendation from './Recommendation';
import { getGender } from '@/modules/core/client/utils/user_info';

// @TODO, pull from config
const DAYS_TO_REPLY = 14;

const ReferenceHeading = styled.div`
  display: flex;
  flex-wrap: wrap-reverse;
  line-height: 1.3em;

  .avatar {
    margin-right: 10px;
  }

  .reference-time {
    margin-left: auto;
    color: #333;
  }

  @media (max-width: 480px) {
   .reference-time {
     width: 100%;
     margin-left: 0;
     margin-bottom: 10px;
   }
`;

const UserMeta = styled.div`
  display: flex;
  flex-direction: column;
`;

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

export default function Reference({ reference }) {
  const { t } = useTranslation('references');

  const {
    _id,
    created,
    feedbackPublic,
    hostedMe,
    hostedThem,
    met,
    public: isPublicReference,
    recommend,
    userFrom,
    userTo,
  } = reference;

  const createdDate = new Date(created);

  // Get how many days are left before experience will become public
  const getDaysLeft = date =>
    Math.max(
      0,
      DAYS_TO_REPLY -
        Math.round((Date.now() - date.getTime()) / 3600 / 24 / 1000),
    );

  return (
    <div className="panel panel-default" id={_id}>
      <div className="panel-body reference">
        <ReferenceHeading>
          <Avatar user={userFrom} size={36} />
          <UserMeta>
            <strong>
              <UserLink user={userFrom} />
            </strong>
            <span className="muted">
              {t('Member since {{memberSince}}', {
                memberSince: new Date(userFrom.created).getFullYear(),
              })}
              {userFrom.gender && `, ${getGender(userFrom.gender)}`}
            </span>
          </UserMeta>
          <a
            className="reference-time"
            href={`/profile/${userTo.username}/references#${_id}`}
          >
            <TimeAgo date={createdDate} />
          </a>
        </ReferenceHeading>

        {!isPublicReference && (
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
                  href={`/profile/${userFrom.username}/references/new`}
                >
                  {t('Write about your experience with them')}
                </a>
              </p>
            )}
          </>
        )}
        <Recommendation
          met={met}
          hostedMe={hostedMe}
          hostedThem={hostedThem}
          recommend={recommend}
        />
        {feedbackPublic && <div>{feedbackPublic}</div>}
      </div>
    </div>
  );
}

Reference.propTypes = {
  reference: PropTypes.object.isRequired,
};
