// External dependencies
import { useTranslation } from 'react-i18next';
import React from 'react';
import styled from 'styled-components';

// Internal dependencies
import '@/config/client/i18n';
import Icon from '@/modules/core/client/components/Icon';

const SofaIcon = styled(Icon)`
  margin-right: 15px;
`;

export default function HostingAndMeetPanel() {
  const { t } = useTranslation('users');

  return (
    <div className="panel panel-default">
      <div className="panel-heading">{t('Hosting & meet')}</div>
      <div className="panel-body">
        <div className="form-horizontal">
          <p>
            <a
              role="button"
              href="/offer/host"
              className="btn btn-inverse-primary"
            >
              <SofaIcon icon="sofa" />
              {t('Modify your hosting location')}
            </a>
          </p>
          <p>
            <a
              role="button"
              href="/offer/meet"
              className="btn btn-inverse-primary"
            >
              <Icon icon="users" />
              {t('Modify your meet locations')}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

HostingAndMeetPanel.propTypes = {};
