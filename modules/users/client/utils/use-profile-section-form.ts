import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { saveFailureReason, useAnalytics } from '@trustroots/analytics/client';

import { useAuth } from '@trustroots/core/auth';
import { update } from '../api/users.api';
import type { UserProfile } from '../types';
import { readApiError } from './api-error';

export default function useProfileSectionForm(
  user: UserProfile,
  section: 'about' | 'locations',
  selectFields: (draftUser: UserProfile) => Parameters<typeof update>[0],
) {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  const { setUser } = useAuth();
  const { track } = useAnalytics();
  const [draftUser, setDraftUser] = useState({ ...user });
  const [hasChanges, setHasChanges] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  function updateDraft(changes: Partial<UserProfile>) {
    setDraftUser(previous => ({ ...previous, ...changes }));
    setHasChanges(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage('');

    try {
      const savedUser = await update(selectFields(draftUser));
      setUser(current => ({ ...current, ...savedUser }));
      setDraftUser({ ...savedUser });
      setHasChanges(false);
      setStatusMessage(t('Profile updated.'));
      track('profile_section_saved', { section });
    } catch (error: unknown) {
      track('profile_save_failed', {
        section,
        reason: saveFailureReason(error),
      });
      const { message } = readApiError(error);
      setStatusMessage(message || t('Something went wrong. Please try again!'));
    }
  }

  return { draftUser, hasChanges, statusMessage, updateDraft, handleSubmit };
}
