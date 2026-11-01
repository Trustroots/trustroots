import React, { useMemo } from 'react';
import { useLocation } from '@tanstack/react-router';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';

import {
  getProfileEditTab,
  getProfileEditTabPath,
  type ProfileEditTab,
} from '../utils/profile-routes';
import type { UserProfile } from '../types';

const EDIT_TABS = [
  { key: 'about', label: 'Edit profile', icon: 'icon-user' },
  { key: 'locations', label: 'Locations', icon: 'icon-globe' },
  { key: 'photo', label: 'Photo', icon: 'icon-picture-change' },
  { key: 'networks', label: 'Networks', icon: 'icon-link' },
  { key: 'account', label: 'Account', icon: 'icon-cog' },
] as const;

function ProfileEditNav({
  activeTab,
  variant,
}: {
  activeTab: ProfileEditTab;
  variant: 'bottom' | 'sidebar';
}) {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  return (
    <ul
      className={classNames('nav', {
        'nav-pills nav-stacked profile-edit-navbar': variant === 'sidebar',
        'navbar-nav': variant === 'bottom',
      })}
      aria-label={t('Profile actions')}
    >
      {EDIT_TABS.map(tab => (
        <li
          key={tab.key}
          className={classNames({ active: activeTab === tab.key })}
        >
          <a
            href={getProfileEditTabPath(tab.key)}
            aria-label={t(tab.label)}
            aria-current={activeTab === tab.key ? 'page' : undefined}
          >
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

function ProfileEditSidebar({
  activeTab,
  username,
  children,
}: {
  activeTab: ProfileEditTab;
  username: string;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

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

export default function ProfileEditPage({
  user,
  children,
}: {
  user: UserProfile;
  children: React.ReactNode;
}) {
  const currentPath = useLocation({ select: location => location.pathname });
  const activeTab = useMemo(
    () => getProfileEditTab(currentPath),
    [currentPath],
  );

  return (
    <>
      <nav className="navbar navbar-default navbar-fixed-bottom visible-xs-block profile-edit-navbar-mobile">
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
