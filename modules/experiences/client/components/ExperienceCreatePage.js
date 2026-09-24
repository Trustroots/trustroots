import React from 'react';
import PropTypes from 'prop-types';
import { useQuery } from 'react-query';
import { useTranslation } from 'react-i18next';
import { useSettings } from '@/modules/core/client/react-app/AppProviders';
import { fetch as fetchProfile } from '@/modules/users/client/api/users.api';
import Avatar from '@/modules/users/client/components/Avatar.component';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import CreateExperience from './CreateExperience.component';

export default function ExperienceCreatePage({ user, username }) {
  const { t } = useTranslation('experiences');
  const { referencesEnabled } = useSettings();
  const {
    data: profile,
    isLoading,
    isError,
  } = useQuery(
    ['experience-recipient', username],
    () => fetchProfile(username),
    { enabled: referencesEnabled, retry: false, refetchOnWindowFocus: false },
  );

  return (
    <section className="container container-spacer">
      <div className="row">
        <div className="col-md-8 col-md-offset-2">
          <h1>{t('Share your experience')}</h1>
          <p>
            <a href={`/profile/${username}`}>{t('Profile', { ns: 'users' })}</a>
          </p>
          {referencesEnabled && isLoading && <LoadingIndicator />}
          {referencesEnabled && isError && (
            <p role="alert">
              {t('Something went wrong. Try again.', { ns: 'core' })}
            </p>
          )}
          {referencesEnabled && profile && (
            <>
              <div className="text-center">
                <Avatar user={profile} size={128} link={false} />
                <h2>{profile.displayName}</h2>
              </div>
              <CreateExperience
                key={profile._id}
                userFrom={user}
                userTo={profile}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

ExperienceCreatePage.propTypes = {
  user: PropTypes.object.isRequired,
  username: PropTypes.string.isRequired,
};
