// External dependencies
import { useTranslation } from 'react-i18next';
import classnames from 'classnames';
import React, { useState, useEffect } from 'react';
import { Badge } from '@trustroots/ui/Badge';

// Internal dependencies
import { getCount as getExperiencesCount } from '@/modules/experiences/client/api/experiences.api';

interface ProfileTabsProps {
  activePathName?: string;
  contactsCount: number;
  initialPathName: string;
  isExperiencesEnabled: boolean;
  isOWnProfile: boolean;
  userId: string;
  username: string;
}

export default function ProfileTabs({
  activePathName,
  contactsCount,
  initialPathName,
  isExperiencesEnabled,
  isOWnProfile,
  userId,
  username,
}: ProfileTabsProps) {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  const [experiencesCount, setExperiencesCount] = useState(0);
  const [hasPendingExperiences, setHasPendingExperiences] = useState(false);
  const pathName = activePathName || initialPathName;

  useEffect(() => {
    const loadExperienceCount = async () => {
      if (isExperiencesEnabled) {
        const { count, hasPending } = await getExperiencesCount(userId);
        setExperiencesCount(count);
        if (hasPending) {
          setHasPendingExperiences(true);
        }
      }
    };

    loadExperienceCount();
  }, []);

  return (
    <div className="profile-tabs" role="navigation">
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
              <Badge
                variant="outline"
                intent="neutral"
                size="sm"
                className="tw:ms-1.25"
              >
                {contactsCount}
              </Badge>
            </a>
          </li>
        )}
        {isExperiencesEnabled && (experiencesCount >= 0 || isOWnProfile) && (
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
              <Badge
                variant="outline"
                intent="neutral"
                size="sm"
                className="tw:ms-1.25"
              >
                {experiencesCount}
                {hasPendingExperiences && (
                  // A dot for experiences waiting for this member's reply.
                  <span
                    data-slot="badge-indicator"
                    aria-hidden="true"
                    className="tw:absolute tw:top-[6px] tw:right-[9px] tw:block tw:size-[7px] tw:rounded-full tw:bg-danger"
                  />
                )}
              </Badge>
            </a>
          </li>
        )}
      </ul>
    </div>
  );
}
