import React from 'react';
import { NamespacesConsumer } from 'react-i18next';
import '@/config/lib/i18n';
import PropTypes from 'prop-types';
import * as languages from '@/config/languages/languages';

export default function ProfileViewBasics({ profile }) {
  return (<NamespacesConsumer ns={['user-profile']}>{ t => (<>
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
    {profile.languages.length &&
      <div className="profile-sidebar-section">
        <h4 id="profile-languages">{t('Languages')}</h4>
        <NamespacesConsumer ns={['languages']}>{ t => (
          <ul className="list-unstyled" aria-describedby="profile-languages">
            {profile.languages.map(code => <li key={code}>{t(languages[code]) || code}</li>)}
          </ul>)}</NamespacesConsumer>
      </div>}
  </>) }</NamespacesConsumer>);
};

ProfileViewBasics.propTypes = {
  profile: PropTypes.object
};
