import React from 'react';
import { NamespacesConsumer } from 'react-i18next';
import '@/config/lib/i18n';
import PropTypes from 'prop-types';

export default function ProfileViewBasics({ profile }) {
  return (<NamespacesConsumer ns="profile-view-basics">{ t => (<>
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
