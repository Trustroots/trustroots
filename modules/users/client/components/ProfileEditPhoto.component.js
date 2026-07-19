import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import Avatar from './Avatar.component';
import ProfileEditPage from './ProfileEditPage.component';
import { update, uploadAvatar } from '../api/users.api';
import { useAuth } from '@/modules/core/client/react-app/auth';
import { useSettings } from '@/modules/core/client/react-app/AppProviders';

export function bytesToSize(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  if (bytes === 0) {
    return '0 Byte';
  }

  const index = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10);
  return `${Math.round(bytes / 1024 ** index)} ${sizes[index]}`;
}

export default function ProfileEditPhoto({ user }) {
  const { t } = useTranslation('users');
  const { setUser } = useAuth();
  /* istanbul ignore next -- settings bootstrap always supplies the upload limit. */
  const { maxUploadSize = 5 * 1024 * 1024 } = useSettings();
  const fileInputRef = useRef(null);
  const [draftUser, setDraftUser] = useState({ ...user });
  const [previewStyle, setPreviewStyle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  async function persistUser(nextUser) {
    const savedUser = await update({
      ...nextUser,
      updated: new Date().toISOString(),
    });
    setUser(savedUser);
    setDraftUser({ ...savedUser });
    setStatusMessage(t('Profile photo updated.'));
  }

  async function handleFileSelected(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      file.type.indexOf('jpeg') === -1 &&
      file.type.indexOf('gif') === -1 &&
      file.type.indexOf('png') === -1
    ) {
      setStatusMessage(t('Please give a jpg, gif, or png image.'));
      return;
    }

    if (file.size > maxUploadSize) {
      setStatusMessage(
        t('Whoops, your file is too big. Please keep it up to {{size}}.', {
          size: bytesToSize(maxUploadSize),
        }),
      );
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      setPreviewStyle(reader.result);
      setIsUploading(true);

      try {
        await uploadAvatar(file);
        await persistUser({
          ...draftUser,
          avatarSource: 'local',
          avatarUploaded: true,
        });
      } catch (error) {
        const status = error?.response?.status ?? error?.status;

        setStatusMessage(
          status === 413
            ? t(
                'Whoops, your file is too big. Please keep it up to {{size}}.',
                {
                  size: bytesToSize(maxUploadSize),
                },
              )
            : status === 415
            ? t('Sorry, we do not support this type of file.')
            : t('Oops! Something went wrong. Try again later.'),
        );
      } finally {
        setIsUploading(false);
        setPreviewStyle('');
      }
    };
  }

  async function handleSourceChange(source) {
    const nextUser = { ...draftUser, avatarSource: source };

    try {
      await persistUser(nextUser);
    } catch (error) {
      setStatusMessage(
        error.response?.data?.message || t('Oops! Something went wrong.'),
      );
    }
  }

  return (
    <ProfileEditPage user={user}>
      <div className="panel panel-default">
        <div className="panel-heading">{t('Profile photo')}</div>
        <div className="panel-body">
          <div className="profile-avatar-choises">
            <div className="row profile-edit-avatar-choise">
              <div className="col-xs-12 col-md-3">
                {previewStyle ? (
                  <div
                    className="avatar avatar-source-preview"
                    style={{ backgroundImage: `url(${previewStyle})` }}
                  />
                ) : (
                  <Avatar
                    link={false}
                    size={128}
                    source={draftUser.avatarSource}
                    user={draftUser}
                  />
                )}
                {isUploading && <span>{t('Wait a moment…')}</span>}
              </div>
              <div className="col-xs-12 col-md-9 profile-edit-avatar-label">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif"
                  hidden
                  onChange={handleFileSelected}
                />
                <button
                  type="button"
                  className="btn btn-default"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {t('Upload photo')}
                </button>
                <div className="profile-edit-avatar-sources">
                  {draftUser.avatarUploaded && (
                    <label className="radio">
                      <input
                        type="radio"
                        checked={draftUser.avatarSource === 'local'}
                        onChange={() => handleSourceChange('local')}
                      />
                      {t('My own')}
                    </label>
                  )}
                  <label className="radio">
                    <input
                      type="radio"
                      checked={draftUser.avatarSource === 'gravatar'}
                      onChange={() => handleSourceChange('gravatar')}
                    />
                    {t('Gravatar')}
                  </label>
                  <label className="radio">
                    <input
                      type="radio"
                      checked={draftUser.avatarSource === 'none'}
                      onChange={() => handleSourceChange('none')}
                    />
                    {t('None')}
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {statusMessage && (
        <p className="help-block" role="status">
          {statusMessage}
        </p>
      )}
    </ProfileEditPage>
  );
}

ProfileEditPhoto.propTypes = {
  user: PropTypes.object.isRequired,
};
