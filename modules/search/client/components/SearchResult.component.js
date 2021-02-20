// External dependencies
import { useTranslation } from 'react-i18next';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

// Internal dependencies
import { getBirthdate, getGender } from '@/modules/users/client/utils/profile';
import { userType } from '@/modules/users/client/users.prop-types';
import Avatar from '@/modules/users/client/components/Avatar.component';
import CirclesInCommon from '@/modules/tribes/client/components/CirclesInCommon';
import LanguageList from '@/modules/users/client/components/LanguageList';

export default function SearchResult({ authenticatedUser, offer }) {
  const { t } = useTranslation('search');
  const { user } = offer;

  console.log('offer:', offer, authenticatedUser); //eslint-disable-line

  const circlesInCommon = (
    <CirclesInCommon user={authenticatedUser} otherUser={user} />
  );

  /*
  const isShortDescription =
    !offer.description || plainTextLength(offer.description) < 1000;
*/
  return (
    <div className="search-result panel panel-default">
      <a className="panel-body" href={`/profile/${user.username}`}>
        <Avatar user={user} size={32} link={false} />
        <h4>
          {user.displayName}{' '}
          <small className="text-muted">@{user.username}</small>
        </h4>
        <div className="search-result-meta">
          {user.birthdate && `${getBirthdate(user.birthdate)} `}
          {user.gender && `${getGender(user.gender)}.`}
        </div>
        {user.tagline && offer.type !== 'meet' && (
          <div className="search-result-tagline">{user.tagline}</div>
        )}
        <div className="search-result-hosting">
          <div className="search-result-label">
            <span
              className={classnames('label', {
                'btn-offer-hosting-maybe':
                  offer.type === 'host' && offer.status === 'maybe',
                'btn-offer-hosting-yes':
                  offer.type === 'host' && offer.status === 'yes',
                'btn-offer-meet': offer.type === 'meet',
              })}
            >
              {offer.type === 'host' && offer.status === 'yes' && t('Hosting')}
              {offer.type === 'host' &&
                offer.status === 'maybe' &&
                t('Maybe hosting')}
              {offer.type === 'meet' && t('Wants to meet')}
            </span>
          </div>

          {/* Short descriptions for 'host' offers */}
          {/*
          <div
            className="search-result-description"
            ng-if="offer.description && offer.description.length < 1000 && offer.type === 'host'"
            ng-bind-html="offer.description | trustedHtml"
          ></div>*/}

          {/* Long descriptions for 'host' offers */}
          {/*
          <div
            className="search-result-description"
            ng-if="earch.offer.description && offer.description.length >= 1000 && offer.type === 'host'"
          >
            <div className="panel-more-wrap">
              <div
                className="panel-more-excerpt"
                ng-bind-html="offer.description | limitTo:1000 | trustedHtml"
              ></div>
              <div
                className="panel-more-fade"
                aria-label="Open profile to see the rest of the description"
              >
                {t('Show more…')}
              </div>
            </div>
          </div>*/}

          {/*
          {isShortDescription && offer.type === 'host' && (
            <ReadMorePanel content={offer.description} id="offer-description" />
          )}
          {isShortDescription && <p>Short</p>}
          */}
          {/*
          Complete descriptions for 'meet' offers
          Meet offers aren't currently visible at profile,
          so we need complete description here.
          */}
          {offer.description && offer.type === 'meet' && (
            <div className="search-result-description">{offer.description}</div>
          )}
          {offer.type === 'meet' && offer.updated && (
            <div className="text-muted">
              {t('Updated {{date}}', { date: new Date(offer.updated) })}
            </div>
          )}

          {circlesInCommon && (
            <div className="search-result-tribes-common">
              <h4>{t('Circles in common')}</h4>
              {circlesInCommon}
            </div>
          )}
        </div>
        {user.languages?.length && (
          <div className="search-result-languages">
            <h4>{t('Languages')}</h4>
            <LanguageList className="list-inline" languages={user.languages} />
          </div>
        )}
      </a>
    </div>
  );
}

SearchResult.propTypes = {
  offer: PropTypes.object.isRequired,
  authenticatedUser: userType.isRequired,
};
