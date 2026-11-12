import React from 'react';
import { Alert } from '@trustroots/ui/Alert';
import { useTranslation } from 'react-i18next';

export default function ContactGuidance() {
  const { t } = useTranslation('contacts');
  return (
    <Alert intent="info" role="note">
      {t(
        'You can message this member without adding them as a contact. Only send contact requests to people you know, and only accept requests from people you know.',
      )}
    </Alert>
  );
}
