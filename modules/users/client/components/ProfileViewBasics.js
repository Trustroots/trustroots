// External dependencies
import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

// Internal dependencies
import {
  getNetworkName,
  hasConnectedAdditionalSocialAccounts,
  isWarmshowersId,
  socialAccountLink,
} from '../utils/networks';
import { getGender } from '@/modules/core/client/utils/user_info';
import LanguageList from './LanguageList';

export default function ProfileViewBasics({ profile }) {
  const { t } = useTranslation(['users']);

  const getBirthdate = birthdate =>
    t('{{birthdate, age}} years.', { birthdate: new Date(birthdate) });

  const getReplyRate = replyRate =>
    t('Reply rate {{replyRate}}.', { replyRate });

  const getReplyTime = replyTime =>
    t('Replies within {{replyTime, fromNow}}.', { replyTime });

  const getMemberSince = created =>
    t('Member since {{date, ll}}', { date: new Date(created) });

  const getSeenOnline = seen => {
    if (seen) {
      return t('Online {{ date, fromNow }}', { date: new Date(seen) });
    }
    return t('Online long ago');
  };

  /*
   * Rendering functions
   */
  const renderReplyData = (replyRate, replyTime) => (
    <div className="profile-sidebar-section text-muted">
      {replyRate && <span>{getReplyRate(replyRate)}</span>}
      {replyTime && (
        <span>
          <br />
          {getReplyTime(replyTime)}
        </span>
      )}
    </div>
  );

  const renderBirthdateAndGender = (birthdate, gender) => {
    return (
      <div className="profile-sidebar-section">
        {birthdate && `${getBirthdate(birthdate)} `}
        {gender && `${getGender(gender)}.`}
      </div>
    );
  };

  const renderMemberSince = created => (
    <div className="profile-sidebar-section">{getMemberSince(created)}</div>
  );

  const renderSeenOnline = seen => (
    <div className="profile-sidebar-section">
      <span>{getSeenOnline(seen)}</span>
    </div>
  );

  const renderLocationLiving = locationLiving => (
    <div className="profile-sidebar-section">
      <i className="icon-fw icon-building text-muted" />
      {/* @TODO remove ns (issue #1368) */}
      <Trans t={t} ns="users">
        Lives in{' '}
        <a href={`/search?location=${locationLiving}`}>{{ locationLiving }}</a>
      </Trans>
    </div>
  );

  const renderLocationFrom = locationFrom => (
    <div className="profile-sidebar-section">
      <i className="icon-fw icon-home text-muted"></i>
      {/* @TODO remove ns (issue #1368) */}
      <Trans t={t} ns="users">
        From <a href={`/search?location=${locationFrom}`}>{{ locationFrom }}</a>
      </Trans>
    </div>
  );

  const renderLanguages = languages => (
    <div className="profile-sidebar-section">
      <h4>{t('Languages')}</h4>
      <LanguageList className="list-unstyled" languages={languages} />
    </div>
  );

  const renderSocialNetworks = profile => (
    <div className="profile-sidebar-section">
      <h4 id="profile-networks" aria-label="Member in other networks">
        {t('Elsewhere')}
      </h4>
      <ul
        className="social-profiles list-unstyled"
        aria-describedby="profile-networks"
      >
        {/*
          Facebook profile link is hidden here until issue with their API gets resolved
          See https://github.com/Trustroots/trustroots/issues/237
        */}
        {/* facebook, github, twitter*/}
        {profile.additionalProvidersData &&
          Object.keys(profile.additionalProvidersData).map(network => {
            return (
              network !== 'facebook' && (
                <li className="social-profile" key={network}>
                  <i
                    className={`social-profile-icon icon-fw icon-lg icon-${network}`}
                  />
                  <a
                    rel="noopener"
                    className="social-profile-handle"
                    href={socialAccountLink(
                      network,
                      profile.additionalProvidersData[network],
                    )}
                  >
                    {getNetworkName(network)}
                  </a>
                </li>
              )
            );
          })}
        {/* BeWelcome */}
        {profile.extSitesBW && (
          <li className="social-profile">
            <i className="social-profile-icon icon-fw icon-lg icon-bw"></i>
            <a
              rel="noopener"
              className="social-profile-handle"
              href={`https://www.bewelcome.org/members/${profile.extSitesBW}`}
            >
              BeWelcome
            </a>
          </li>
        )}

        {/* Couchsurfing */}
        {profile.extSitesCS && (
          <li className="social-profile">
            <i className="social-profile-icon icon-fw icon-lg icon-cs"></i>
            {/*
            Link here has `noreferrer` because;
            https://github.com/Trustroots/trustroots/issues/464
          */}
            <a
              rel="noreferrer noopener"
              className="social-profile-handle"
              href={`https://www.couchsurfing.com/people/${profile.extSitesCS}`}
            >
              Couchsurfing
            </a>
          </li>
        )}
        {/* WarmShowers */}
        {profile.extSitesWS && (
          <li className="social-profile">
            <i className="social-profile-icon icon-fw icon-lg icon-warmshowers"></i>
            <a
              className="social-profile-handle"
              href={`https://www.warmshowers.org/${
                isWarmshowersId(profile.extSitesWS) ? 'user' : 'users'
              }/${profile.extSitesWS}`}
            >
              Warmshowers
            </a>
          </li>
        )}
      </ul>
    </div>
  );

  return (
    <div>
      {(profile.isVolunteer || profile.isVolunteerAlumni) && (
        <div className="profile-sidebar-section">
          ✨{' '}
          <a href="/team">
            {profile.isVolunteer && t('Trustroots volunteer')}
            {profile.isVolunteerAlumni && t('Trustroots volunteer alumni')}
          </a>
        </div>
      )}

      {/* reply rate and reply time */}
      {(profile.replyRate || profile.replyTime) &&
        renderReplyData(profile.replyRate, profile.replyTime)}

      {/* birthdate and gender */}
      {(profile.birthdate || profile.gender) &&
        renderBirthdateAndGender(profile.birthdate, profile.gender)}

      {/* member since */}
      {renderMemberSince(profile.created)}
      {/* seen online */}
      {renderSeenOnline(profile.seen)}

      {/* location living */}
      {profile.locationLiving && renderLocationLiving(profile.locationLiving)}

      {/* location from */}
      {profile.locationFrom && renderLocationFrom(profile.locationFrom)}

      {/* languages */}
      {profile.languages.length > 0 && renderLanguages(profile.languages)}

      {/* social networks */}
      {(hasConnectedAdditionalSocialAccounts(profile) ||
        profile.extSitesBW ||
        profile.extSitesCS ||
        profile.extSitesWS) &&
        renderSocialNetworks(profile)}
    </div>
  );
}

ProfileViewBasics.propTypes = {
  profile: PropTypes.object,
};
