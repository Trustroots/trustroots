import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Trans, useTranslation } from 'react-i18next';
import classnames from 'classnames';
import styled from 'styled-components';

import * as api from '../api/tribes.api';
import JoinButton from './JoinButton';
import { getRouteParams } from '@/modules/core/client/services/angular-compat';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
// import { getCircleBackgroundStyle } from '@/modules/tribes/client/utils';

export default function CirclePage({ user }) {
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
    return <LoadingIndicator />;
  }

  // Circle not found
  if (!circle?._id) {
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
            <a href="/circles" className="btn btn-primary">
              {t('See other circles')}
            </a>
          </div>
        </div>
      </section>
    );
  }

  // const circleStyles = getCircleBackgroundStyle(circle, '1400x900');
  //  background-image: url(${circleStyles.backgroundImage});
  //  background-color: ${circleStyles.backgroundColor};
  const CircleBoard = styled.section``;

  return (
    <CircleBoard
      className={classnames('board tribe-image tribe-header', {
        'is-guest': !user,
      })}
    >
      <div className="tribe-header-info">
        <div className="container">
          <div className="row no-gutters">
            <div className="col-xs-12">
              <a
                href="/circles"
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
              <div className="col-xs-10 col-sm-offset-1 col-sm-7 col-md-6 col-lg-5">
                <p className="lead tribe-pre">{t('Circle')}</p>
                <h2 className="font-brand-regular tribe-title">
                  {circle.label}
                </h2>
                <div className="tribe-meta">
                  {t('{{count}} members', { count: circle.count })}
                </div>
                {circle.description && (
                  <div className="lead tribe-meta">{circle.description}</div>
                )}
                <br />
                <br />
                <JoinButton
                  icon={false}
                  size="lg"
                  style="primary"
                  tribe={circle}
                  user={user}
                />
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
              </div>
            )}
            {/* For non authenticated members */}
            {!user && (
              <div className="col-xs-12 col-sm-offset-1 col-sm-7 col-md-6 col-lg-5">
                <p className="lead tribe-pre">{t('Trustroots circle')}</p>
                <h2 className="font-brand-regular tribe-title">
                  {circle.label}
                </h2>
                <div className="lead tribe-meta">
                  {t('{{count}} members', { count: circle.count })}
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
                    href={`/signup?tribe=${circle.slug}`}
                  >
                    {t(`Join {{circle}} on Trustroots`, {
                      circle: circle.label,
                    })}
                  </a>
                  <br />
                  <a
                    className="btn btn-lg btn-link tribe-readmore"
                    href={`/?circle=${circle.slug}`}
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
            <Trans ns="tribes" t={t}>
              Photo by
              {circle.attribution._url ? (
                <a href={circle.attribution_url}>{circle.attribution}</a>
              ) : (
                circle.attribution
              )}
            </Trans>
          </small>
        )}
      </div>
    </CircleBoard>
  );
}

CirclePage.propTypes = {
  user: PropTypes.object,
};
