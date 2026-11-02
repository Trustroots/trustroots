import { useTranslation } from 'react-i18next';
import React from 'react';

import '@/config/client/i18n';
import Icon from '@/modules/core/client/components/Icon';
import { Button, type ButtonStyleProps } from '@trustroots/ui/Button';

type ReportMemberProps = {
  className?: string;
  /** The button look; a small default button unless given. */
  look?: ButtonStyleProps;
  username?: string;
};

/**
 * A button to report a member to Trustroots support
 * @param {string} className - extra class names for the link
 * @param {ButtonStyleProps} look - the button look of the link
 * @param {string} username - the username of the user to report
 */
export default function ReportMember({
  className,
  look = { size: 'sm' },
  username,
}: ReportMemberProps) {
  const { t } = useTranslation('support');

  if (!username) {
    return null;
  }

  return (
    <Button
      {...look}
      render={<a href={`/support?report=${username}`} />}
      className={className}
      aria-label={t('Report member {{username}} to support', {
        username,
      })}
    >
      <Icon icon="flag" />
      {t('Report member to support')}
    </Button>
  );
}
