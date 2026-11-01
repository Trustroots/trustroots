// External dependencies
import { useTranslation } from 'react-i18next';
import { Button } from '@trustroots/ui/Button';
import React from 'react';

// Internal dependencies
import '@/config/client/i18n';
import Icon from '@/modules/core/client/components/Icon';

export default function HostingAndMeetPanel() {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  return (
    <div className="panel panel-default">
      <div className="panel-heading">{t('Hosting')}</div>
      <div className="panel-body">
        <div className="form-horizontal">
          <p>
            <Button
              variant="inverse"
              colour="primary"
              className="d-inline-flex align-items-center gap-2"
              render={<a href="/offer/host" />}
              role="button"
            >
              <Icon icon="sofa" size={undefined} className={undefined} />
              {t('Modify your hosting location')}
            </Button>
          </p>
        </div>
      </div>
    </div>
  );
}
