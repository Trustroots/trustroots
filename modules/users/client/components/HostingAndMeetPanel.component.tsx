// External dependencies
import { useTranslation } from 'react-i18next';
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
            <a
              role="button"
              href="/offer/host"
              className="btn btn-inverse-primary d-inline-flex align-items-center gap-2"
            >
              <Icon icon="sofa" size={undefined} className={undefined} />
              {t('Modify your hosting location')}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

HostingAndMeetPanel.propTypes = {};
