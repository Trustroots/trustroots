import RichText from '@/modules/core/client/components/RichText';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled, { css } from 'styled-components';

import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import JoinButton from './JoinButton';
import CircleMemberDiscovery from './CircleMemberDiscovery';
import HackerspaceMap from './HackerspaceMap';
import HitchhikingMap from './HitchhikingMap';
import RadioCircle from './RadioCircle';
import { getCircleBackgroundStyle } from '../utils';
import * as api from '../api/tribes.api';
import type { MembershipUpdate, TribeSummary } from '../api/tribes.api';
import type { UserProfile } from '@/modules/users/client/types';

const resourceLinkProps = {
  rel: 'noopener noreferrer',
  referrerPolicy: 'no-referrer' as const,
};

export function getTribeHeaderBackgroundStyle(tribe: TribeSummary) {
  const style = getCircleBackgroundStyle(tribe, '1400x900');

  return css`
    ${
      style.backgroundImage ? `background-image: ${style.backgroundImage};` : ''
    }
    ${
      style.backgroundColor ? `background-color: ${style.backgroundColor};` : ''
    }
  `;
}

const Header = styled.section.attrs({
  className: 'board tribe-image tribe-header' as string,
})<{ tribe: TribeSummary }>`
  &&& {
    position: relative;
    ${({ tribe }) => getTribeHeaderBackgroundStyle(tribe)}
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
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchTribe() {
      setIsLoading(true);

      try {
        const data = await api.get(circle);

        if (isMounted) {
          setTribe(data);
          setIsMember(Boolean(user?.memberIds?.includes(data._id)));
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
  }, [circle, user]);

  const handleMembershipUpdated = (data: MembershipUpdate) => {
    if (data?.tribe) {
      setTribe(data.tribe);
    }
    const updatedTribeId = data?.tribe?._id || tribe?._id;
    if (data?.user?.memberIds && updatedTribeId) {
      setIsMember(data.user.memberIds.includes(updatedTribeId));
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
  const isHackersCircle = tribe.slug === 'hackers';
  const hasLocationMap = isHackersCircle || tribe.slug === 'hitchhikers';

  return (
    <>
      <Header
        tribe={tribe}
        className={`${user ? '' : 'is-guest'} ${
          hasLocationMap ? 'has-location-map' : ''
        } ${tribe.slug === 'radio' ? 'has-radio-player' : ''}`}
      >
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
                className={
                  hasLocationMap
                    ? 'col-xs-12 col-md-5 col-lg-5'
                    : `${
                        user ? 'col-xs-10' : 'col-xs-12'
                      } col-sm-offset-1 col-sm-7 col-md-6 col-lg-6`
                }
              >
                <p className="lead tribe-pre">
                  {user
                    ? (t('Circle') as string)
                    : (t('Trustroots circle') as string)}
                </p>
                <h2 className="font-brand-regular tribe-title">
                  {tribe.label}
                </h2>
                <span className="tribe-meta">{countInfo}</span>
                {tribe.description && (
                  <RichText
                    className="lead tribe-meta"
                    content={tribe.description}
                    allowLinks
                  />
                )}
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
                  <div className="tribe-actions-group">
                    {user.roles?.includes('admin') && (
                      <a
                        className="btn btn-default"
                        href={`/admin/circles/${encodeURIComponent(tribe.slug)}`}
                      >
                        {t('Edit circle') as string}
                      </a>
                    )}
                    <JoinButton
                      tribe={tribe}
                      user={user}
                      className="btn btn-default"
                      activeClassName="btn btn-default circle-membership-active"
                      icon={false}
                      memberLabel={t("You're a member") as string}
                      onUpdated={handleMembershipUpdated}
                    />
                    <a
                      className="btn btn-primary"
                      href={`/search?tribe=${tribe.slug}`}
                    >
                      {t('Find members') as string}
                    </a>
                    {wikiUrl && !isHackersCircle && (
                      <a
                        className="btn btn-default"
                        href={wikiUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t('Circle Wiki') as string}
                      </a>
                    )}
                  </div>
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
                {wikiUrl && !user && !isHackersCircle && (
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
              {hasLocationMap && (
                <div className="col-xs-12 col-md-7 col-lg-7 circle-hero-map">
                  {isHackersCircle ? <HackerspaceMap /> : <HitchhikingMap />}
                </div>
              )}
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
      {tribe.slug === 'radio' && (
        <RadioCircle key={user?._id || 'visitor'} user={user} />
      )}
      {/* Keep this a reviewed snapshot rendered as JSX text and fixed HTTPS links.
          Do not embed remote wiki HTML, scripts, images or frames here. */}
      <div
        className={
          isHackersCircle
            ? `hackers-circle-community${
                user && isMember ? ' has-members' : ''
              }`
            : undefined
        }
      >
        {isHackersCircle && (
          <section className="hackers-circle-resources">
            <h3>{t('Hackerspaces and community workshops') as string}</h3>
            <p>
              {
                t(
                  'Trustroots is open source, and hackers are welcome to help improve the codebase that runs the network.',
                ) as string
              }{' '}
              <a
                {...resourceLinkProps}
                href="https://github.com/trustroots/trustroots/"
              >
                {t('Explore the Trustroots codebase') as string}
              </a>
              .
            </p>
            <p>
              {
                t(
                  'Use these directories to discover hackerspaces, hacklabs, makerspaces and community workshops. Listings may be out of date or incomplete, so check a space’s own website or contact its members before visiting.',
                ) as string
              }
            </p>
            <ul>
              <li>
                <a
                  {...resourceLinkProps}
                  href="https://wiki.hackerspaces.org/Category:Hackerspace"
                >
                  HackerspaceWiki
                </a>{' '}
                — {t('community-maintained directory') as string}
              </li>
              <li>
                <a {...resourceLinkProps} href="https://atlas.hackerspace.sh/">
                  Hackerspace Atlas
                </a>{' '}
                — {t('map based on HackerspaceWiki data') as string}
              </li>
              <li>
                <a
                  {...resourceLinkProps}
                  href="https://github.com/SpaceApi/directory"
                >
                  SpaceAPI directory
                </a>{' '}
                — {t('spaces publishing a SpaceAPI endpoint') as string}
              </li>
              <li>
                <a
                  {...resourceLinkProps}
                  href="https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service"
                >
                  Wikidata Query Service
                </a>{' '}
                — {t('structured data for places and communities') as string}
              </li>
              <li>
                <a {...resourceLinkProps} href="https://hackspace.org.uk/">
                  HackspaceUK
                </a>{' '}
                — {t('UK-focused directory and community resource') as string}
              </li>
            </ul>
            <div className="hackers-circle-resource-footer">
              <a
                {...resourceLinkProps}
                className="btn btn-default"
                href={wikiUrl}
              >
                {t('Circle Wiki') as string}
              </a>
              <small className="text-muted">
                {t('Adapted from the') as string}{' '}
                <a
                  {...resourceLinkProps}
                  href="https://wiki.trustroots.org/index.php?title=Hackers&oldid=26505"
                >
                  Trustroots Wiki
                </a>
                {' · '}
                <a
                  {...resourceLinkProps}
                  href="https://creativecommons.org/licenses/by-sa/4.0/"
                >
                  CC BY-SA 4.0
                </a>
              </small>
            </div>
          </section>
        )}
        {user && isMember && (
          <CircleMemberDiscovery circle={tribe} user={user} />
        )}
      </div>
    </>
  );
}
