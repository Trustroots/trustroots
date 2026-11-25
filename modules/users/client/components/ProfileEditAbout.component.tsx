import { Input } from '@trustroots/ui/Input';
import { Select } from '@trustroots/ui/Select';
import React from 'react';
import { Button } from '@trustroots/ui/Button';
import { useTranslation } from 'react-i18next';

import BirthdateSelect from '@/modules/core/client/components/BirthdateSelect.component';
import TrEditor from '@/modules/core/client/components/TrEditor';
import ProfileEditLanguages from './ProfileEditLanguages.component';
import ProfileEditPage from './ProfileEditPage.component';
import { plainTextLength } from '@/modules/core/client/utils/filters';
import { useSettings } from '@trustroots/core/app-context';
import type { UserProfile } from '../types';
import useProfileSectionForm from '../utils/use-profile-section-form';

export default function ProfileEditAbout({ user }: { user: UserProfile }) {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  const { profileMinimumLength = 140 } = useSettings();
  const { draftUser, hasChanges, statusMessage, updateDraft, handleSubmit } =
    useProfileSectionForm(user, 'about', draftUser => ({
      firstName: draftUser.firstName,
      lastName: draftUser.lastName,
      tagline: draftUser.tagline,
      description: draftUser.description,
      gender: draftUser.gender,
      birthdate: draftUser.birthdate,
      languages: draftUser.languages,
      languageLevels: draftUser.languageLevels,
    }));

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
              <small>{t('Highlight text to change text appearance.')}</small>
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

        <div className="panel panel-default">
          <div className="panel-heading">{t('Basics')}</div>
          <div className="panel-body">
            <div className="form-horizontal">
              <div className="form-group">
                <label
                  htmlFor="firstname"
                  className="tw:sm:grid-col-3 text-right control-label"
                >
                  {t('First name')}
                </label>
                <div className="tw:sm:grid-col-9 tw:md:grid-col-7 tw:lg:grid-col-6">
                  <Input
                    type="text"
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
                  className="tw:sm:grid-col-3 text-right control-label"
                >
                  {t('Last name (optional)')}
                </label>
                <div className="tw:sm:grid-col-9 tw:md:grid-col-7 tw:lg:grid-col-6">
                  <Input
                    type="text"
                    id="lastname"
                    aria-describedby="lastNameHelp"
                    value={draftUser.lastName || ''}
                    onChange={event =>
                      updateDraft({ lastName: event.target.value })
                    }
                  />
                  <p className="help-block" id="lastNameHelp">
                    {t(
                      'You can use a nickname. You don’t need to share your full name.',
                    )}
                  </p>
                </div>
              </div>
              <div className="form-group">
                <label
                  htmlFor="tagline"
                  className="tw:sm:grid-col-3 text-right control-label"
                >
                  {t('Short tagline')}
                </label>
                <div className="tw:sm:grid-col-9 tw:md:grid-col-7 tw:lg:grid-col-6">
                  <Input
                    type="text"
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
                  className="tw:sm:grid-col-3 text-right control-label"
                >
                  {t('I Am')}
                </label>
                <div className="tw:sm:grid-col-9 tw:md:grid-col-7 tw:lg:grid-col-6">
                  <Select
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
                  </Select>
                </div>
              </div>
              <div className="form-group">
                <label className="tw:sm:grid-col-3 text-right control-label">
                  {t('Birthdate')}
                </label>
                <div className="tw:sm:grid-col-9">
                  <BirthdateSelect
                    onChange={birthdate => updateDraft({ birthdate })}
                    value={draftUser.birthdate || ''}
                  />
                </div>
              </div>
              <ProfileEditLanguages
                onChangeLanguages={languages => updateDraft({ languages })}
                profileLanguages={draftUser.languages || []}
                languageLevels={draftUser.languageLevels}
                onChangeLevels={languageLevels =>
                  updateDraft({ languageLevels })
                }
              />
            </div>
          </div>
        </div>

        <Button
          intent="primary"
          size="lg"
          className="profile-editor-save"
          type="submit"
          disabled={!hasChanges}
        >
          {t('Save')}
        </Button>

        {statusMessage && (
          <p className="help-block" role="status">
            {statusMessage}
          </p>
        )}
      </form>
    </ProfileEditPage>
  );
}
