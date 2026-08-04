/**
 * Bottom navigation for small screens
 */

import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import '@/config/client/i18n';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';

import { useCurrentPath } from '@/modules/core/client/react-app/useCurrentPath';
import { getProfileViewTab } from '../utils/profile-routes';

export default function BottomNavigationSmall({
  username,
  isSelf,
  contactCount,
}) {
  const currentPath = useCurrentPath();
  const pathTab = getProfileViewTab(currentPath, username);
  const [active, setActive] = useState(pathTab);
  const { t } = useTranslation('users');

  useEffect(() => {
    setActive(pathTab);
  }, [pathTab]);

  const tabs = [
    {
      key: 'overview',
      label: t('Overview'),
      link: `/profile/${username}/overview`,
    },
    {
      key: 'about',
      label: t('About'),
      link: `/profile/${username}`,
    },
    {
      key: 'accommodation',
      label: t('Hosting'),
      link: `/profile/${username}/accommodation`,
    },
  ];

  if (contactCount > 0 || isSelf) {
    tabs.push({
      key: 'contacts',
      label: t('Contacts'),
      link: `/profile/${username}/contacts`,
      count: contactCount,
    });
  }

  return (
    <nav
      className="navbar navbar-default navbar-fixed-bottom visible-xs-block"
      role="navigation"
    >
      <div className="container">
        <ul className="nav navbar-nav" role="tablist">
          {tabs.map(({ key, label, link, count }) => (
            <li
              key={key}
              className={classNames({ active: active === key })}
              role="presentation"
            >
              <a href={link} role="tab" onClick={() => setActive(key)}>
                {label} <span className="badge">{count}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

BottomNavigationSmall.propTypes = {
  isSelf: PropTypes.bool.isRequired,
  contactCount: PropTypes.number.isRequired,
  username: PropTypes.string.isRequired,
};
