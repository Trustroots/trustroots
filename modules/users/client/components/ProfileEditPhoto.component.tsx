import React, { useRef, useState } from 'react';
import { Button } from '@trustroots/ui/Button';
import { useTranslation } from 'react-i18next';

import Avatar from './Avatar.component';
import ProfileEditPage from './ProfileEditPage.component';
import { update, uploadAvatar } from '../api/users.api';
import { useAuth } from '@/modules/core/client/react-app/auth';
import { useSettings } from '@/modules/core/client/react-app/app-context';
import { formatBytes } from '@/modules/core/client/utils/format';
import type { UserProfile } from '../types';
import { readApiError } from '../utils/api-error';

export default function ProfileEditPhoto({ user }: { user: UserProfile }) {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  const { setUser } = useAuth();
  /* istanbul ignore next -- settings bootstrap always supplies the upload limit. */
  const { maxUploadSize = 20 * 1024 * 1024 } = useSettings();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [draftUser, setDraftUser] = useState({ ...user });
  const [previewStyle, setPreviewStyle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  async function persistUser(nextUser: UserProfile) {
    const savedUser = await update({
      avatarSource: nextUser.avatarSource,
      avatarUploaded: nextUser.avatarUploaded,
    });
    setUser(current => ({ ...current, ...savedUser }));
    setDraftUser({ ...savedUser });
    setStatusMessage(t('Profile photo updated.'));
  }

  async function handleFileSelected(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const type = file.type.toLowerCase();
    const supported = type
      ? /^image\/(?:jpe?g|gif|png)$/.test(type)
      : /\.(jpe?g|gif|png)$/i.test(file.name);
    if (!supported) {
      setStatusMessage(t('Please give a jpg, gif, or png image.'));
      return;
    }

    if (file.size > maxUploadSize) {
      setStatusMessage(
        t('Whoops, your file is too big. Please keep it up to {{size}}.', {
          size: formatBytes(maxUploadSize),
        }),
      );
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      setPreviewStyle(typeof reader.result === 'string' ? reader.result : '');
      setIsUploading(true);

      try {
        await uploadAvatar(file);
        await persistUser({
          ...draftUser,
          avatarSource: 'local',
          avatarUploaded: true,
        });
      } catch (error: unknown) {
        const { status } = readApiError(error);

        setStatusMessage(
          status === 413
            ? t(
                'Whoops, your file is too big. Please keep it up to {{size}}.',
                {
                  size: formatBytes(maxUploadSize),
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

  async function handleSourceChange(source: 'local' | 'gravatar' | 'none') {
    const nextUser = { ...draftUser, avatarSource: source };

    try {
      await persistUser(nextUser);
    } catch (error: unknown) {
      const { message } = readApiError(error);
      setStatusMessage(message || t('Oops! Something went wrong.'));
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
                  aria-describedby="profile-photo-upload-help"
                  onChange={handleFileSelected}
                />
                <Button
                  className="profile-photo-picker"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  aria-describedby="profile-photo-upload-help"
                >
                  {t('Upload photo')}
                </Button>
                <p id="profile-photo-upload-help" className="help-block">
                  {t('JPG, PNG or GIF. Maximum file size: {{size}}.', {
                    size: formatBytes(maxUploadSize),
                  })}{' '}
                  {t('Photos are automatically resized.')}
                </p>
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
