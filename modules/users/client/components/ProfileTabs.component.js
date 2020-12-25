// External dependencies
import { useTranslation } from 'react-i18next';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';

// Internal dependencies
import { $on } from '@/modules/core/client/services/angular-compat';
import { getCount as getExperiencesCount } from '@/modules/references/client/api/references.api';

export default function ProfileTabs({
  contactsCount,
  initialPathName,
  isExperiencesEnabled,
  isOWnProfile,
  userId,
  username,
}) {
  const { t } = useTranslation('users');
  const [experiencesCount, setExperiencesCount] = useState(0);
  const [pathName, setPathName] = useState(initialPathName);

  useEffect(async () => {
    const count = await getExperiencesCount(userId);
    setExperiencesCount(count);
  }, []);

  // Handle tab changes from Angular UI router
  useEffect(
    () =>
      $on('$stateChangeSuccess', (event, { name }) => {
        setPathName(name);
      }),
    [],
  );

  return (
    <div className="profile-tabs hidden-xs" role="navigation">
      <ul
        className="nav panel panel-default nav-pills nav-narrow nav-underline"
        role="tablist"
      >
        <li
          className={classnames({
            active: pathName === 'profile.about',
          })}
          role="presentation"
        >
          <a href={`/profile/${username}`} role="tab">
            {t('About')}
          </a>
        </li>
        {(contactsCount || isOWnProfile) && (
          <li
            className={classnames({
              active: pathName === 'profile.contacts',
            })}
            role="presentation"
          >
            <a
              aria-label={t('{{count}} contacts', {
                count: contactsCount,
              })}
              href={`/profile/${username}/contacts`}
              role="tab"
            >
              {t('Contacts')}
              <span className="badge">{contactsCount}</span>
            </a>
          </li>
        )}
        {isExperiencesEnabled && (experiencesCount > 0 || isOWnProfile) && (
          <li
            className={classnames({
              active: pathName === 'profile.experiences.list',
            })}
            role="presentation"
          >
            <a
              aria-label={t('{{count}} experiences', {
                count: experiencesCount,
              })}
              href={`/profile/${username}/experiences`}
              role="tab"
            >
              {t('Experiences')}
              <span className="badge">{experiencesCount}</span>
            </a>
          </li>
        )}
      </ul>
    </div>
  );
}

ProfileTabs.propTypes = {
  contactsCount: PropTypes.number,
  initialPathName: PropTypes.string.isRequired,
  isExperiencesEnabled: PropTypes.bool.isRequired,
  isOWnProfile: PropTypes.bool.isRequired,
  username: PropTypes.string.isRequired,
  userId: PropTypes.string.isRequired,
};
