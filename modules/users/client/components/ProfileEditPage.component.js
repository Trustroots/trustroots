import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';

import { useCurrentPath } from '@/modules/core/client/react-app/useCurrentPath';
import {
  getProfileEditTab,
  getProfileEditTabPath,
} from '../utils/profile-routes';

const EDIT_TABS = [
  { key: 'about', label: 'Edit profile', icon: 'icon-user' },
  { key: 'locations', label: 'Locations', icon: 'icon-globe' },
  { key: 'photo', label: 'Photo', icon: 'icon-picture-change' },
  { key: 'networks', label: 'Networks', icon: 'icon-link' },
  { key: 'account', label: 'Account', icon: 'icon-cog' },
];

function ProfileEditNav({ activeTab, variant }) {
  const { t } = useTranslation('users');

  return (
    <ul
      className={classNames('nav', {
        'nav-pills nav-stacked profile-edit-navbar': variant === 'sidebar',
        'navbar-nav': variant === 'bottom',
      })}
      role="toolbar"
      aria-label={t('Profile actions')}
    >
      {EDIT_TABS.map(tab => (
        <li
          key={tab.key}
          className={classNames({ active: activeTab === tab.key })}
        >
          <a href={getProfileEditTabPath(tab.key)} aria-label={t(tab.label)}>
            {variant === 'bottom' ? (
              <i className={`${tab.icon} icon-2x`} role="presentation" />
            ) : (
              t(tab.label)
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}

ProfileEditNav.propTypes = {
  activeTab: PropTypes.string.isRequired,
  variant: PropTypes.oneOf(['bottom', 'sidebar']).isRequired,
};

function ProfileEditSidebar({ activeTab, username, children }) {
  const { t } = useTranslation('users');

  return (
    <>
      <ProfileEditNav activeTab={activeTab} variant="sidebar" />
      <p>
        <br />
        <br />
        <a href={`/profile/${username}`} className="btn btn-block btn-default">
          {t('View profile')}
        </a>
      </p>
      {children}
    </>
  );
}

ProfileEditSidebar.propTypes = {
  activeTab: PropTypes.string.isRequired,
  children: PropTypes.node,
  username: PropTypes.string.isRequired,
};

export default function ProfileEditPage({ user, children }) {
  const currentPath = useCurrentPath();
  const activeTab = useMemo(
    () => getProfileEditTab(currentPath),
    [currentPath],
  );

  return (
    <>
      <nav className="navbar navbar-default navbar-fixed-bottom visible-xs-block">
        <div className="container">
          <ProfileEditNav activeTab={activeTab} variant="bottom" />
        </div>
      </nav>

      <section className="container container-spacer profile-edit">
        <div className="row">
          <div className="col-sm-3 hidden-xs">
            <ProfileEditSidebar
              activeTab={activeTab}
              username={user.username}
            />
          </div>
          <div className="col-xs-12 col-sm-9">{children}</div>
        </div>
      </section>
    </>
  );
}

ProfileEditPage.propTypes = {
  children: PropTypes.node.isRequired,
  user: PropTypes.object.isRequired,
};
