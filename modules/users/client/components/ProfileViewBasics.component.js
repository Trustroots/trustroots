import React from 'react';
import { NamespacesConsumer } from 'react-i18next';
import '@/modules/core/client/components/i18n';
import PropTypes from 'prop-types';

export default function ProfileViewBasics({ profile }) {
  return (<NamespacesConsumer ns="profile-view-basics">{ t => (<>
    <div className="profile-sidebar-section">
      {t('Member since {{date, MMM Do, YYYY}}', { date: profile.created })}
    </div>
    <div className="profile-sidebar-section">
      <span>
        {(profile.seen) ? t('Online {{date, fromNow}}', { date: profile.seen }) : t('Online long ago')}
      </span>
    </div>
  </>) }</NamespacesConsumer>);
};

ProfileViewBasics.propTypes = {
  profile: PropTypes.object
};
