import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import styled, { css } from 'styled-components';

import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import JoinButton from './JoinButton';
import { getCircleBackgroundStyle } from '../utils';
import * as api from '../api/tribes.api';
import type { MembershipUpdate, TribeSummary } from '../api/tribes.api';
import type { UserProfile } from '@/modules/users/client/types';

const Header = styled.section.attrs({
  className: 'board tribe-image tribe-header' as string,
})<{ tribe: TribeSummary }>`
  &&& {
    position: relative;
    ${({ tribe }) => {
      if (!tribe) return '';
      const style = getCircleBackgroundStyle(tribe, '1400x900');
      return css`
        ${style.backgroundImage
          ? `background-image: ${style.backgroundImage};`
          : ''}
        ${style.backgroundColor
          ? `background-color: ${style.backgroundColor};`
          : ''}
      `;
    }}
  }
`;

function circleWikiUrl(tribe: TribeSummary | null): string {
  const slug = tribe?.slug;

  if (!slug) {
    return '';
  }

  return `https://wiki.trustroots.org/en/${encodeURIComponent(
    slug.charAt(0).toUpperCase() + slug.slice(1),
  )}`;
}

export default function TribeDetailPage({
  circle,
  user,
  onMembershipUpdated,
}: {
  circle: string;
  user?: UserProfile;
  onMembershipUpdated: (data: MembershipUpdate) => void;
}) {
  const { t } = useTranslation('circles') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  const [tribe, setTribe] = useState<TribeSummary | null>(null);
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
          setTribe(null);
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

  const handleMembershipUpdated = (data: MembershipUpdate) => {
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
        <small aria-hidden="true">{t('Wait a moment…') as string}</small>
      </div>
    );
  }

  if (!tribe?._id) {
    return (
      <section className="container container-spacer">
        <div className="row">
          <div className="col-xs-12">
            <h2>{t('This circle is not here...') as string}</h2>
            <p className="lead">
              {
                t(
                  "The circle you're seeking isn't here. Check if your address is correct.",
                ) as string
              }
            </p>
            <a href="/circles" className="btn btn-primary">
              {t('See other circles') as string}
            </a>
          </div>
        </div>
      </section>
    );
  }

  const countInfo: string =
    tribe.count === 0
      ? (t('No members yet') as string)
      : tribe.count === 1
      ? (t('One member') as string)
      : (t('{{count, number}} members', { count: tribe.count }) as string);
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
                <i className="icon-left"></i> {t('More circles') as string}
              </a>
            </div>
          </div>
          <div className="row">
            <div
              className={`${
                user ? 'col-xs-10' : 'col-xs-12'
              } col-sm-offset-1 col-sm-7 col-md-6 col-lg-5`}
            >
              <p className="lead tribe-pre">
                {user
                  ? (t('Circle') as string)
                  : (t('Trustroots circle') as string)}
              </p>
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
              {!user && (
                <p className="lead tribe-intro">
                  {
                    t(
                      "Trustroots is a travellers' community for sharing, hosting and getting people together.",
                    ) as string
                  }
                  <br />
                  <br />
                  {
                    t(
                      'Join to meet, host and get hosted by this and other communities.',
                    ) as string
                  }
                </p>
              )}
              {user ? (
                <>
                  <JoinButton
                    tribe={tribe}
                    user={user}
                    className="btn btn-lg btn-default"
                    activeClassName="btn btn-lg btn-primary btn-action"
                    icon={false}
                    memberLabel={t("You're a member") as string}
                    onUpdated={handleMembershipUpdated}
                  />
                  &nbsp;
                  <a
                    className="btn btn-lg btn-default"
                    href={`/search?tribe=${tribe.slug}`}
                  >
                    {t('Find members') as string}
                  </a>
                </>
              ) : (
                <a
                  className="btn btn-lg btn-primary btn-action tribe-join"
                  href={`/signup?tribe=${tribe.slug}`}
                >
                  {
                    t('Join {{label}} on Trustroots', {
                      label: tribe.label,
                    }) as string
                  }
                </a>
              )}
              {!user && (
                <a
                  className="btn btn-lg btn-link tribe-readmore"
                  href={`/?circle=${tribe.slug}`}
                >
                  <i className="icon-right"></i>{' '}
                  {t('How does it work?') as string}
                </a>
              )}
              {wikiUrl && (
                <a
                  className="btn btn-lg btn-link tribe-readmore"
                  href={wikiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('Circle Wiki') as string}
                </a>
              )}
              {user && (
                <p className="lead tribe-intro">
                  {
                    t(
                      'Trustroots is built on communities. Share this page within your community and invite them to join!',
                    ) as string
                  }
                </p>
              )}
            </div>
          </div>
        </div>
        {tribe.attribution && (
          <small className="hidden-xs font-brand-light tribe-attribution">
            {t('Photo by') as string}{' '}
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
  circle: PropTypes.string.isRequired,
  onMembershipUpdated: PropTypes.func.isRequired,
  user: PropTypes.object,
};
