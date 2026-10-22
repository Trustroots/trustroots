import React from 'react';
import { useTranslation } from 'react-i18next';

export default function ContactGuidance() {
  const { t } = useTranslation('contacts');
  return (
    <p className="alert alert-info" role="note">
      {t<string>(
        'You can message this member without adding them as a contact. Only send contact requests to people you know, and only accept requests from people you know.',
      )}
    </p>
  );
}
