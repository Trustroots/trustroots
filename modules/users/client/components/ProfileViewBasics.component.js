import React from 'react';
import classnames from 'classnames';
import { withNamespaces } from './utils/i18n-angular-load';
import '@/config/lib/i18n';
import PropTypes from 'prop-types';
import * as languages from '@/config/languages/languages';
import { hasConnectedAdditionalSocialAccounts, isWarmshowersId, socialAccountLink } from './utils/networks';

export function ProfileViewBasics({ t, profile }) {
  const renderReplyData = (replyRate, replyTime) => (
    <div className="profile-sidebar-section text-muted">
      {replyRate &&
      <span>
        {t('Reply rate {{replyRate}}.', { replyRate: profile.replyRate })}
      </span>}
      {replyTime &&
      <span>
        <br/>
        {t('Replies within {{replyTime, fromNow}}.', { replyTime: profile.replyTime })}
      </span>}
    </div>
  );

  const renderBirthdateAndGender = (birthdate, gender) => (
    <div className="profile-sidebar-section" >
      {birthdate && t('{{birthdate, age}} years', { birthdate: new Date(birthdate) })}
      {(birthdate && gender) && <span>, </span>}
      <span className={classnames({ 'text-capitalize': !birthdate })}>{t(gender)}.</span>
    </div>
  );

  const renderMemberSince = () => (
    <div className="profile-sidebar-section">
      {t('Member since {{date, MMM Do, YYYY}}', { date: new Date(profile.created) })}
    </div>
  );

  const renderSeenOnline = () => {
    <div className="profile-sidebar-section">
      <span>
        {(profile.seen) ? t('Online {{date, fromNow}}', { date: new Date(profile.seen) }) : t('Online long ago')}
      </span>
    </div>;
  };

  const renderLocationLiving = locationLiving => (
    <div className="profile-sidebar-section">
      <i className="icon-fw icon-building text-muted" />
      {t('Lives in')}{' '}
      <a ui-sref="search.map({location: locationLiving})">
        {locationLiving}
      </a>
    </div>
  );

  const renderLocationFrom = locationFrom => (
    <div className="profile-sidebar-section">
      <i className="icon-fw icon-home text-muted"></i>
      {t('From')}{' '}
      <a ui-sref="search.map({location: locationFrom})">
        {locationFrom}
      </a>
    </div>
  );

  const renderLanguages = languagesList => (
    <div className="profile-sidebar-section">
      <h4 id="profile-languages">
        {t('Languages')}
      </h4>
      <ul className="list-unstyled" aria-describedby="profile-languages">
        {languagesList.map(
          code => <li key={code}>{t(languages[code], { ns: 'languages' }) || code}</li>
        )}
      </ul>
    </div>
  );

  const renderSocialNetworks = profile => (
    <div className="profile-sidebar-section">
      <h4 id="profile-networks" aria-label="Member in other networks">
        {t('Elsewhere')}
      </h4>
      <ul className="social-profiles list-unstyled"
        aria-describedby="profile-networks">
        {/*
          Facebook profile link is hidden here until issue with their API gets resolved
          See https://github.com/Trustroots/trustroots/issues/237
        */}
        {/* facebook, github, twitter*/}
        {profile.additionalProvidersData && Object.keys(profile.additionalProvidersData).map(
          (network) => {
            return network !== 'facebook' &&
              (<li className="social-profile" key={network}>
                <i className={`social-profile-icon icon-fw icon-lg icon-${network}`} />
                <a rel="noopener"
                  className="social-profile-handle text-capitalize"
                  href={socialAccountLink(network, profile.additionalProvidersData[network])}>{network}
                </a>
              </li>);
          }
        )}
        {/* BeWelcome */}
        {profile.extSitesBW &&
        <li className="social-profile">
          <i className="social-profile-icon icon-fw icon-lg icon-bw"></i>
          <a rel="noopener"
            className="social-profile-handle"
            href={`https://www.bewelcome.org/members/${profile.extSitesBW}`}>
            BeWelcome
          </a>
        </li>}

        {/* Couchsurfing */}
        {profile.extSitesCS &&
        <li className="social-profile">
          <i className="social-profile-icon icon-fw icon-lg icon-cs"></i>
          {/*
            Link here has `noreferrer` because;
            https://github.com/Trustroots/trustroots/issues/464
          */}
          <a rel="noreferrer noopener"
            className="social-profile-handle"
            href={`https://www.couchsurfing.com/people/${profile.extSitesCS }`}>
            Couchsurfing
          </a>
        </li>}
        {/* WarmShowers */}
        {profile.extSitesWS &&
        <li className="social-profile">
          <i className="social-profile-icon icon-fw icon-lg icon-warmshowers"></i>
          <a className="social-profile-handle"
            href={`https://www.warmshowers.org/${isWarmshowersId(profile) ? 'user' : 'users' }/${profile.extSitesWS}`}>
            Warmshowers
          </a>
        </li>}
      </ul>
    </div>
  );

  return (<>
    {/* reply rate and reply time */}
    {(profile.replyRate || profile.replyTime) && renderReplyData(profile.replyRate, profile.replyTime)}

    {/* birthdate and gender */}
    {(profile.birthdate || profile.gender) && renderBirthdateAndGender(profile.birthdate, profile.gender)}

    {/* member since */}
    {renderMemberSince()}
    {/* seen online */}
    {renderSeenOnline()}

    {/* location living */}
    { profile.locationLiving && renderLocationLiving(profile.locationLiving) }

    {/* location from */}
    {profile.locationFrom && renderLocationFrom(profile.locationFrom)}

    {/* languages */}
    {profile.languages.length > 0 && renderLanguages(profile.languages)}

    {/* social networks */}
    { (hasConnectedAdditionalSocialAccounts(profile) || profile.extSitesBW || profile.extSitesCS || profile.extSitesWS) &&
        renderSocialNetworks(profile)
    }
  </>);
};

ProfileViewBasics.propTypes = {
  profile: PropTypes.object,
  t: PropTypes.func
};

export default withNamespaces(['user-profile', 'languages'])(ProfileViewBasics);