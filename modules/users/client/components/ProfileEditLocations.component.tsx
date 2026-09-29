import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import LocationInput from '@/modules/core/client/components/LocationInput.component';
import HostingAndMeetPanel from './HostingAndMeetPanel.component';
import ProfileEditPage from './ProfileEditPage.component';
import { update } from '../api/users.api';
import { useAuth } from '@/modules/core/client/react-app/auth';
import type { UserProfile } from '../types';
import { readApiError } from '../utils/api-error';

export default function ProfileEditLocations({ user }: { user: UserProfile }) {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  const { setUser } = useAuth() as { setUser: (user: UserProfile) => void };
  const [draftUser, setDraftUser] = useState({ ...user });
  const [hasChanges, setHasChanges] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  function updateDraft(changes: Partial<UserProfile>) {
    setDraftUser(previous => ({ ...previous, ...changes }));
    setHasChanges(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage('');

    try {
      const savedUser = await update(draftUser);
      setUser(savedUser);
      setDraftUser({ ...savedUser });
      setHasChanges(false);
      setStatusMessage(t('Profile updated.'));
    } catch (error: unknown) {
      const { message } = readApiError(error);
      setStatusMessage(message || t('Something went wrong. Please try again!'));
    }
  }

  return (
    <ProfileEditPage user={user}>
      <form onSubmit={handleSubmit} autoComplete="off">
        <div className="panel panel-default">
          <div className="panel-heading">{t('Locations')}</div>
          <div className="panel-body">
            <div className="form-horizontal">
              <div className="form-group">
                <label
                  htmlFor="location-living"
                  className="col-sm-3 text-right control-label"
                >
                  {t('Where do you live')}
                </label>
                <div className="col-sm-9 col-md-7 col-lg-6">
                  <LocationInput
                    id="location-living"
                    limitLocationTypes
                    onChange={value => updateDraft({ locationLiving: value })}
                    placeholder={t('City, Country')}
                    value={draftUser.locationLiving || ''}
                  />
                </div>
              </div>
              <div className="form-group">
                <label
                  htmlFor="location-from"
                  className="col-sm-3 text-right control-label"
                >
                  {t('Where are you from')}
                </label>
                <div className="col-sm-9 col-md-7 col-lg-6">
                  <LocationInput
                    id="location-from"
                    limitLocationTypes
                    onChange={value => updateDraft({ locationFrom: value })}
                    placeholder={t('City, Country')}
                    value={draftUser.locationFrom || ''}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <p>
          <button
            type="submit"
            className="btn btn-lg btn-primary profile-editor-save"
            disabled={!hasChanges}
          >
            {t('Save')}
          </button>
        </p>
      </form>

      <HostingAndMeetPanel />

      {statusMessage && (
        <p className="help-block" role="status">
          {statusMessage}
        </p>
      )}
    </ProfileEditPage>
  );
}

ProfileEditLocations.propTypes = {
  user: PropTypes.object.isRequired,
};
