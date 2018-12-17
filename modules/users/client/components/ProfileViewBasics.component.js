import React from 'react';
import { NamespacesConsumer } from 'react-i18next';
import '@/config/lib/i18n';
import PropTypes from 'prop-types';

export default function ProfileViewBasics({ profile }) {
  return (<NamespacesConsumer ns="user-profile">{ t => (<>
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
      <span className={(!profile.birthdate) && 'text-capitalize'}>{t(profile.gender)}.</span>
    </div>}
    <div className="profile-sidebar-section">
      {t('Member since {{date, MMM Do, YYYY}}', { date: new Date(profile.created) })}
    </div>
    <div className="profile-sidebar-section">
      <span>
        {(profile.seen) ? t('Online {{date, fromNow}}', { date: new Date(profile.seen) }) : t('Online long ago')}
      </span>
    </div>
  </>) }</NamespacesConsumer>);
};

ProfileViewBasics.propTypes = {
  profile: PropTypes.object
};
