import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@trustroots/ui/Alert';
import { plainTextLength } from '@/modules/core/client/utils/filters';
import type { PublicProfile } from '../../shared/profile';

type ProfileDetails = Pick<
  PublicProfile,
  'description' | 'avatarSource' | 'avatarUploaded' | 'emailHash'
>;

export default function ProfileCompletionReminders({
  profile,
}: {
  profile: ProfileDetails;
}) {
  const { t } = useTranslation('users');
  const hasDescription = plainTextLength(profile.description) > 0;
  const hasPhoto =
    (profile.avatarSource === 'local' && profile.avatarUploaded) ||
    (profile.avatarSource === 'gravatar' && Boolean(profile.emailHash));

  if (hasDescription && hasPhoto) return null;

  return (
    <Alert intent="info" role="note">
      <ul className="list-unstyled tw:m-0">
        {!hasDescription && (
          <li>
            <a href="/profile/edit">{t('Add an About me description')}</a>
          </li>
        )}
        {!hasPhoto && (
          <li>
            <a href="/profile/edit/photo">{t('Add a profile photo')}</a>
          </li>
        )}
      </ul>
    </Alert>
  );
}
