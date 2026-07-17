import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { getCurrentRouteParams } from '@/modules/core/client/services/client-runtime';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import JoinButton from './JoinButton';
import { getCircleBackgroundStyle } from '../utils';
import * as api from '../api/tribes.api';

const Header = styled.section.attrs({
  className: 'board tribe-image tribe-header',
})`
  &&& {
    position: relative;
    ${({ tribe }) => tribe && getCircleBackgroundStyle(tribe, '1400x900')}
  }
`;

function circleWikiUrl(tribe) {
  const slug = tribe?.slug;

  if (!slug) {
    return '';
  }

  return `https://wiki.trustroots.org/en/${encodeURIComponent(
    slug.charAt(0).toUpperCase() + slug.slice(1),
  )}`;
}

export default function TribeDetailPage({ user, onMembershipUpdated }) {
  const { t } = useTranslation('circles');
  const { circle } = getCurrentRouteParams();
  const [tribe, setTribe] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchTribe() {
      setIsLoading(true);

      try {
        const data = await api.get(circle);

        if (isMounted) {
          setTribe(data);
        }
      } catch {
        if (isMounted) {
          setTribe({});
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchTribe();

    return () => {
      isMounted = false;
    };
  }, [circle]);

  const handleMembershipUpdated = data => {
    if (data?.tribe) {
      setTribe(data.tribe);
    }

    onMembershipUpdated(data);
  };

  if (isLoading) {
    return (
      <div className="container container-spacer text-muted text-center">
        <LoadingIndicator />
        <br />
        <br />
        <small aria-hidden="true">{t('Wait a moment…')}</small>
      </div>
    );
  }

  if (!tribe?._id) {
    return (
      <section className="container container-spacer">
        <div className="row">
          <div className="col-xs-12">
            <h2>{t('This circle is not here...')}</h2>
            <p className="lead">
              {t(
                "The circle you're seeking isn't here. Check if your address is correct.",
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

  const countInfo =
    tribe.count === 0
      ? t('No members yet')
      : t('{{count, number}} members', { count: tribe.count });
  const wikiUrl = circleWikiUrl(tribe);

  return (
    <Header tribe={tribe} className={user ? undefined : 'is-guest'}>
      <div className="tribe-header-info">
        <div className="container">
          <div className="row no-gutters">
            <div className="col-xs-12">
              <a
                href="/circles"
                className="btn btn-lg btn-link tribe-header-back"
              >
                <i className="icon-left"></i> {t('More circles')}
              </a>
            </div>
          </div>
          <div className="row">
            <div className="col-xs-10 col-sm-offset-1 col-sm-7 col-md-6 col-lg-5">
              <p className="lead tribe-pre">{t('Circle')}</p>
              <h2 className="font-brand-regular tribe-title">{tribe.label}</h2>
              <span className="tribe-meta">{countInfo}</span>
              {tribe.description && (
                <div
                  className="lead tribe-meta"
                  dangerouslySetInnerHTML={{ __html: tribe.description }}
                />
              )}
              <br />
              <br />
              {user ? (
                <>
                  <JoinButton
                    tribe={tribe}
                    user={user}
                    icon={false}
                    onUpdated={handleMembershipUpdated}
                  />
                  &nbsp;
                  <a
                    className="btn btn-lg btn-default"
                    href={`/search/map?tribe=${tribe.slug}`}
                  >
                    {t('Find members')}
                  </a>
                </>
              ) : (
                <a
                  className="btn btn-lg btn-primary btn-action tribe-join"
                  href={`/signup?tribe=${tribe.slug}`}
                >
                  {t('Join {{label}} on Trustroots', { label: tribe.label })}
                </a>
              )}
              {wikiUrl && (
                <a
                  className="btn btn-lg btn-link tribe-readmore"
                  href={wikiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('Circle Wiki')}
                </a>
              )}
            </div>
          </div>
        </div>
        {tribe.attribution && (
          <small className="hidden-xs font-brand-light tribe-attribution">
            {t('Photo by')}{' '}
            {tribe.attribution_url ? (
              <a href={tribe.attribution_url}>{tribe.attribution}</a>
            ) : (
              tribe.attribution
            )}
          </small>
        )}
      </div>
    </Header>
  );
}

TribeDetailPage.propTypes = {
  onMembershipUpdated: PropTypes.func.isRequired,
  user: PropTypes.object,
};
