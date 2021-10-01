import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';
import { brandName } from '@/modules/core/client/utils/constants';

export default function DownloadProfile({ username, userId }) {
  const { t } = useTranslation('users');

  return (
    <div className="panel panel-default" id="download">
      <div className="panel-heading">{t('Download your data')}</div>
      <div className="panel-body">
        <div className="row">
          <div className="col-xs-12 col-sm-5">
            <p className="text-muted">
              {t(
                'Your data is yours. We are committed to making it easy for you to get all of your data into, and out of, {{brandName}} at any time.',
                {
                  brandName,
                },
              )}
            </p>
          </div>
          <div className="ccol-xs-12 col-sm-7">
            <ul className="list-unstyled">
              <li>
                <a
                  className="btn btn-link btn-sm"
                  href={`/api/users/${username}`}
                  target="_top"
                  type="application/json"
                  download="profile.json"
                >
                  {t('Profile')}
                </a>
                <small className="text-muted">(json)</small>
              </li>
              <li>
                <a
                  className="btn btn-link btn-sm"
                  href={`/api/contacts/${userId}`}
                  target="_top"
                  type="application/json"
                  download="contacts.json"
                >
                  {t('Contacts')}
                </a>
                <small className="text-muted">(json)</small>
              </li>
              <li>
                <a
                  className="btn btn-link btn-sm"
                  href={`/api/offers-by/${userId}`}
                  target="_top"
                  type="application/json"
                  download="offers.json"
                >
                  {t('Hosting offer')}
                </a>
                <small className="text-muted">(json)</small>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

DownloadProfile.propTypes = {
  userId: PropTypes.string.isRequired,
  username: PropTypes.string.isRequired,
};
