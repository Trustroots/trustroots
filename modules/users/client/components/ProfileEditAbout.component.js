import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import BirthdateSelect from '@/modules/core/client/components/BirthdateSelect.component';
import TrEditor from '@/modules/core/client/components/TrEditor';
import ProfileEditLanguages from './ProfileEditLanguages.component';
import ProfileEditPage from './ProfileEditPage.component';
import { update } from '../api/users.api';
import { plainTextLength } from '@/modules/core/client/utils/filters';
import { useAuth } from '@/modules/core/client/react-app/auth';
import { useSettings } from '@/modules/core/client/react-app/AppProviders';

export default function ProfileEditAbout({ user }) {
  const { t } = useTranslation('users');
  const { setUser } = useAuth();
  const { profileMinimumLength = 140 } = useSettings();
  const [draftUser, setDraftUser] = useState({ ...user });
  const [hasChanges, setHasChanges] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  function updateDraft(changes) {
    setDraftUser(previous => ({ ...previous, ...changes }));
    setHasChanges(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatusMessage('');

    try {
      const savedUser = await update(draftUser);
      setUser(savedUser);
      setDraftUser({ ...savedUser });
      setHasChanges(false);
      setStatusMessage(t('Profile updated.'));
    } catch (error) {
      setStatusMessage(
        error.response?.data?.message ||
          t('Something went wrong. Please try again!'),
      );
    }
  }

  const descriptionLength = plainTextLength(draftUser.description || '');

  return (
    <ProfileEditPage user={user}>
      <form onSubmit={handleSubmit} autoComplete="off">
        <div className="panel panel-default">
          <label htmlFor="description" className="panel-heading">
            {t('Describe Yourself')}
          </label>
          <div className="panel-body">
            <div className="form-group">
              <TrEditor
                id="description"
                onChange={value => updateDraft({ description: value })}
                placeholder={t('Type in your description…')}
                text={draftUser.description || ''}
              />
              <p className="help-block">
                {t(
                  'Help other people get to know you by telling them about your life and the things you like.',
                )}
              </p>
              {descriptionLength > 0 &&
                descriptionLength < profileMinimumLength && (
                  <p className="help-block">
                    <strong className="text-danger pull-left">
                      {t(
                        'Write longer description in order to send messages to other members.',
                      )}
                    </strong>
                  </p>
                )}
            </div>
          </div>
          <div className="panel-footer">
            <div id="descriptionHelp" className="help-block">
              <small>
                {t('Highlight text to add links or change text appearance.')}
              </small>
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

        <div className="panel panel-default">
          <div className="panel-heading">{t('Basics')}</div>
          <div className="panel-body">
            <div className="form-horizontal">
              <div className="form-group">
                <label
                  htmlFor="firstname"
                  className="col-sm-3 text-right control-label"
                >
                  {t('First name')}
                </label>
                <div className="col-sm-9 col-md-7 col-lg-6">
                  <input
                    type="text"
                    className="form-control"
                    id="firstname"
                    value={draftUser.firstName || ''}
                    onChange={event =>
                      updateDraft({ firstName: event.target.value })
                    }
                  />
                </div>
              </div>
              <div className="form-group">
                <label
                  htmlFor="lastname"
                  className="col-sm-3 text-right control-label"
                >
                  {t('Last name')}
                </label>
                <div className="col-sm-9 col-md-7 col-lg-6">
                  <input
                    type="text"
                    className="form-control"
                    id="lastname"
                    value={draftUser.lastName || ''}
                    onChange={event =>
                      updateDraft({ lastName: event.target.value })
                    }
                  />
                </div>
              </div>
              <div className="form-group">
                <label
                  htmlFor="tagline"
                  className="col-sm-3 text-right control-label"
                >
                  {t('Short tagline')}
                </label>
                <div className="col-sm-9 col-md-7 col-lg-6">
                  <input
                    type="text"
                    className="form-control"
                    id="tagline"
                    value={draftUser.tagline || ''}
                    onChange={event =>
                      updateDraft({ tagline: event.target.value })
                    }
                  />
                  <p className="help-block">
                    {t('What is your mission or life motto?')}
                  </p>
                </div>
              </div>
              <div className="form-group">
                <label
                  htmlFor="gender"
                  className="col-sm-3 text-right control-label"
                >
                  {t('I Am')}
                </label>
                <div className="col-sm-9 col-md-7 col-lg-6">
                  <select
                    className="form-control"
                    id="gender"
                    value={draftUser.gender || ''}
                    onChange={event =>
                      updateDraft({ gender: event.target.value })
                    }
                  >
                    <option value="">{t("I'd rather not tell")}</option>
                    <option value="female">{t('Female')}</option>
                    <option value="male">{t('Male')}</option>
                    <option value="non-binary">{t('Non-binary')}</option>
                    <option value="other">{t('Other')}</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="col-sm-3 text-right control-label">
                  {t('Birthdate')}
                </label>
                <div className="col-sm-9">
                  <BirthdateSelect
                    onChange={birthdate => updateDraft({ birthdate })}
                    value={draftUser.birthdate}
                  />
                </div>
              </div>
              <ProfileEditLanguages
                onChangeLanguages={languages => updateDraft({ languages })}
                profileLanguages={draftUser.languages || []}
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-lg btn-primary profile-editor-save"
          disabled={!hasChanges}
        >
          {t('Save')}
        </button>

        {statusMessage && (
          <p className="help-block" role="status">
            {statusMessage}
          </p>
        )}
      </form>
    </ProfileEditPage>
  );
}

ProfileEditAbout.propTypes = {
  user: PropTypes.object.isRequired,
};
