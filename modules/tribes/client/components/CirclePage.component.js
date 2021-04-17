import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import * as api from '../api/tribes.api';
import JoinButton from './JoinButton';
import { getRouteParams } from '@/modules/core/client/services/angular-compat';

export default function CirclePage({ user, goBack }) {
  const [circle, setCircle] = useState(null);
  const { t } = useTranslation('tribes');

  const fetchData = async () => {
    const circle = await api.get(getRouteParams().circle);
    setCircle(circle);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Circle loading
  if (!circle) {
    return (
      <div className="container container-spacer text-muted text-center">
        {/* <!-- tr-spinner will have `aria-busy` etc --> */}
        {/* <tr-spinner size="sm"></tr-spinner> */}
        <br />
        <br />
        <small aria-hidden="true">{t('Wait a moment...')}</small>
      </div>
    );
  }

  // Circle not found
  if (!circle._id) {
    return (
      <section className="container container-spacer">
        <div className="row">
          <div className="col-xs-12">
            <h2>{t('This circle is not here...')}</h2>
            <p className="lead">
              {t(
                `The circle you're seeking isn't here. Check if your address is correct.`,
              )}
            </p>
            <a onClick={goBack} className="btn btn-primary">
              {t('See other circles')}
            </a>
          </div>
        </div>
      </section>
    );
  }

  // Circle found
  return (
    <section
      className={`board tribe-image tribe-header ${!user ? 'is-guest' : ''}`}
      tr-tribe-styles="{{::tribeCtrl.tribe}}"
      tr-tribe-styles-dimensions="1400x900"
    >
      <div className="tribe-header-info">
        <div className="container">
          <div className="row no-gutters">
            <div className="col-xs-12">
              <a
                onClick={goBack}
                className="btn btn-lg btn-link tribe-header-back"
              >
                <i className="icon-left"></i>
                {t('More circles')}
              </a>
            </div>
          </div>
          <div className="row">
            {/* For authenticated members */}
            {user && (
              <div
                className="col-xs-10 col-sm-offset-1 col-sm-7 col-md-6 col-lg-5"
                // ng-if="app.user"
              >
                <p className="lead tribe-pre">{t('Circle')}</p>
                <h2 className="font-brand-regular tribe-title">
                  {circle.label}
                </h2>
                <div className="tribe-meta">
                  {circle.count === 0 && t('No members yet')}
                  {circle.count === 1 && t('One memeber')}
                  {circle.count > 1 && t(`${circle.count} members`)}
                </div>
                {circle.description && (
                  <div className="lead tribe-meta">{t(circle.description)}</div>
                )}
                <br />
                <br />
                <JoinButton tribe={circle} user={user} onUpdated={() => {}} />
                &nbsp;
                <a
                  className="btn btn-lg btn-default"
                  href={`/search?tribe=${circle.slug}`}
                  type="button"
                >
                  {t('Find members')}
                </a>
                <br />
                <br />
                <p className="lead tribe-intro">
                  {t(
                    'Trustroots is built on communities. Share this page within your community and invite them to join!',
                  )}
                </p>
                {circle.label && (
                  <>
                    {/* Twitter share button */}
                    <div
                      className="tribe-share"
                      tr-share-twitter
                      data-text={t(
                        `Join to meet, host and get hosted by Trustroots circle ${circle.label} — I'm in!`,
                      )}
                    ></div>
                    {/* FB share button */}
                    <div className="tribe-share" tr-share-fb></div>
                  </>
                )}
              </div>
            )}
            {/* For non authenticated members */}
            {!user && (
              <div className="col-xs-12 col-sm-offset-1 col-sm-7 col-md-6 col-lg-5">
                <p className="lead tribe-pre">{t('Trustroots circle')}</p>
                <h2 className="font-brand-regular tribe-title">
                  {t(circle.label)}
                </h2>
                <div className="lead tribe-meta">
                  {circle.count === 0 && t('No members yet')}
                  {circle.count === 1 && t('One memeber')}
                  {circle.count > 1 && t(`${circle.count} members`)}
                </div>
                <br />
                <br />
                <p className="lead tribe-intro">
                  {t(
                    `Trustroots is a travellers' community for sharing, hosting and getting people together.`,
                  )}
                  <br />
                  <br />
                  {t(
                    'Join to meet, host and get hosted by this and other communities.',
                  )}
                  <br />
                  <br />
                  <a
                    className="btn btn-lg btn-primary btn-action tribe-join"
                    ui-sref="signup({'tribe': tribeCtrl.tribe.slug})"
                  >
                    {t(`Join ${circle.label} on Trustroots`)}
                  </a>
                  <br />
                  <a
                    className="btn btn-lg btn-link tribe-readmore"
                    ui-sref="home({'circle': tribeCtrl.tribe.slug})"
                  >
                    <i className="icon-right"></i>
                    {t('How does it work?')}
                  </a>
                </p>
              </div>
            )}
          </div>
        </div>
        {circle.attribution && (
          <small className="hidden-xs font-brand-light tribe-attribution">
            {t('Photo by')}
            {circle.attribution._url && (
              <a href={circle.attribution_url}>{circle.attribution}</a>
            )}
            {!circle.attribution_url && <span>{circle.attribution}</span>}
          </small>
        )}
      </div>
    </section>
  );
}

CirclePage.propTypes = {
  user: PropTypes.object,
  goBack: PropTypes.func,
};
