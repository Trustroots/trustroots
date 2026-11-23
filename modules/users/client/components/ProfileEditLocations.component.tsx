import React from 'react';
import { Button } from '@trustroots/ui/Button';
import { useTranslation } from 'react-i18next';

import LocationInput from '@/modules/core/client/components/LocationInput.component';
import HostingAndMeetPanel from './HostingAndMeetPanel.component';
import ProfileEditPage from './ProfileEditPage.component';
import type { UserProfile } from '../types';
import useProfileSectionForm from '../utils/use-profile-section-form';

export default function ProfileEditLocations({ user }: { user: UserProfile }) {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  const { draftUser, hasChanges, statusMessage, updateDraft, handleSubmit } =
    useProfileSectionForm(user, 'locations', draftUser => ({
      locationLiving: draftUser.locationLiving,
      locationFrom: draftUser.locationFrom,
    }));

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
                  className="tw:sm:grid-col-3 text-right control-label"
                >
                  {t('Where do you live')}
                </label>
                <div className="tw:sm:grid-col-9 tw:md:grid-col-7 tw:lg:grid-col-6">
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
                  className="tw:sm:grid-col-3 text-right control-label"
                >
                  {t('Where are you from')}
                </label>
                <div className="tw:sm:grid-col-9 tw:md:grid-col-7 tw:lg:grid-col-6">
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
          <Button
            intent="primary"
            size="lg"
            className="profile-editor-save"
            type="submit"
            disabled={!hasChanges}
          >
            {t('Save')}
          </Button>
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
