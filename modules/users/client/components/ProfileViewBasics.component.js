import React from 'react';
import { NamespacesConsumer } from 'react-i18next';
import '@/config/lib/i18n';
import PropTypes from 'prop-types';
import * as languages from '@/config/languages/languages';
import { hasConnectedAdditionalSocialAccounts, isWarmshowersId, socialAccountLink } from './utils';

export default function ProfileViewBasics({ profile }) {
  return (<NamespacesConsumer ns={['user-profile', 'languages']}>{ (t) => (<>
    {/* show div only if replyrate or replyTime is present */}
    {(profile.replyRate || profile.replyTime) &&
    <div className="profile-sidebar-section text-muted">
      {profile.replyRate &&
      <span>
        {t('Reply rate {{replyRate}}.', { replyRate: profile.replyRate })}
      </span>}
      {profile.replyTime &&
      <span>
        <br/>
        {t('Replies within {{replyTime, fromNow}}.', { replyTime: profile.replyTime })}
      </span>}
    </div>}
    {/* show div only if birthdate or gender is present */}
    {(profile.birthdate || profile.gender) &&
    <div className="profile-sidebar-section" >
      {profile.birthdate && t('{{birthdate, age}} years', { birthdate: new Date(profile.birthdate) })}
      {(profile.birthdate && profile.gender) && <span>, </span>}
      <span className={(!profile.birthdate) ? 'text-capitalize' : null }>{t(profile.gender)}.</span>
    </div>}
    <div className="profile-sidebar-section">
      {t('Member since {{date, MMM Do, YYYY}}', { date: new Date(profile.created) })}
    </div>
    <div className="profile-sidebar-section">
      <span>
        {(profile.seen) ? t('Online {{date, fromNow}}', { date: new Date(profile.seen) }) : t('Online long ago')}
      </span>
    </div>
    {profile.locationLiving &&
      <div className="profile-sidebar-section">
        <i className="icon-fw icon-building text-muted"></i>
        {t('Lives in')} <a ui-sref="search.map({location: profileCtrl.profile.locationLiving})"
        >{profile.locationLiving}</a>
      </div>}
    {profile.locationFrom &&
      <div className="profile-sidebar-section">
        <i className="icon-fw icon-home text-muted"></i>
        {t('From')} <a ui-sref="search.map({location: profileCtrl.profile.locationFrom})">
          {profile.locationFrom}</a>
      </div>}
    {profile.languages.length > 0 &&
      <div className="profile-sidebar-section">
        <h4 id="profile-languages">{t('Languages')}</h4>
        <ul className="list-unstyled" aria-describedby="profile-languages">
          {profile.languages.map(code => <li key={code}>{t(languages[code], { ns: 'languages' }) || code}</li>)}
        </ul>
      </div>}
      { (hasConnectedAdditionalSocialAccounts(profile) || profile.extSitesBW || profile.extSitesCS || profile.extSitesWS) &&
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
            {profile.additionalProvidersData && Object.keys(profile.additionalProvidersData).map(
              (key, indeks) =>
              {return (key !== 'facebook') && <li className="social-profile" key={indeks}><i className={`social-profile-icon icon-fw icon-lg icon-${key}`}></i>
                <a rel="noopener"
                  className="social-profile-handle text-capitalize"
                  href={socialAccountLink(key, profile.additionalProvidersData[key])}>{key}
                </a>
              </li>;
              }
            )}

            {profile.extSitesBW &&
            <li className="social-profile">
              <i className="social-profile-icon icon-fw icon-lg icon-bw"></i>
              <a rel="noopener"
                className="social-profile-handle"
                href={`https://www.bewelcome.org/members/${profile.extSitesBW}`}>
                BeWelcome
              </a>
            </li>}

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

            {profile.extSitesWS &&
            <li className="social-profile">
              <i className="social-profile-icon icon-fw icon-lg icon-warmshowers"></i>
              <a className="social-profile-handle"
                href={`https://www.warmshowers.org/${isWarmshowersId(profile) ? 'user' : 'users' }/${profile.extSitesWS}`}>
                Warmshowers
              </a>
            </li>}
          </ul>
        </div>}
  </>) }</NamespacesConsumer>);
};

ProfileViewBasics.propTypes = {
  profile: PropTypes.object
};
