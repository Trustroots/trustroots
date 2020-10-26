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

// @TODO, pull from config
const DAYS_TO_REPLY = 14;

const ReferenceHeading = styled.div`
  display: flex;
  align-items: center;
  .avatar {
    margin-right: 10px;
  }
  time {
    margin-left: auto;
  }
`;

const UserMeta = styled.div`
  display: flex;
  flex-direction: column;
`;

export default function Reference({ reference }) {
  const { t } = useTranslation('references');

  const {
    _id,
    feedbackPublic,
    hostedMe,
    hostedThem,
    met,
    public: publicReference,
    recommend,
    userFrom,
    userTo,
  } = reference;

  const created = new Date(reference.created);

  const getDaysLeft = created =>
    DAYS_TO_REPLY -
    Math.round((Date.now() - created.getTime()) / 3600 / 24 / 1000);

  ReferenceHeading;

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
            </span>
          </UserMeta>
          <time dateTime={created} className="text-color-links">
            <a href={`/profile/${userTo.username}/references#${_id}`}>
              <TimeAgo date={created} />
            </a>
          </time>
        </ReferenceHeading>

        {!publicReference && (
          <div>
            <div>
              <small>{t('pending')}</small>
            </div>
            <div>
              {t('{{daysLeft}} days left', { daysLeft: getDaysLeft(created) })}
            </div>
            {userFrom?.username && (
              <div>
                <a
                  className="btn btn-xs btn-primary"
                  href={`/profile/${userFrom.username}/references/new`}
                >
                  {t('Give a reference')}
                </a>
              </div>
            )}
          </div>
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
