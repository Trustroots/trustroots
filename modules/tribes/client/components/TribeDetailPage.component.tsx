import RichText from '@/modules/core/client/components/RichText';
import { Button } from '@trustroots/ui/Button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { useTranslation } from 'react-i18next';

import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import lazyMap from '@/modules/core/client/components/lazyMap';
import MemberSearchCard from '@/modules/users/client/components/MemberSearchCard.component';
import JoinButton from './JoinButton';
import EditCircle from './EditCircle';
import CircleMemberDiscovery from './CircleMemberDiscovery';
import RadioCircle from './RadioCircle';
import TopicChat from './TopicChat';
import { getCircleBackgroundStyle } from '../utils';
import { circleQuery, setCachedCircle } from '../api/circle-queries';
import type { MembershipUpdate, TribeSummary } from '../api/tribes.api';
import type { UserProfile } from '@/modules/users/client/types';

const HackerspaceMap = lazyMap(() => import('./HackerspaceMap'));
const HitchhikingMap = lazyMap(() => import('./HitchhikingMap'));

const resourceLinkProps = {
  rel: 'noopener noreferrer',
  referrerPolicy: 'no-referrer' as const,
};

export function getTribeHeaderBackgroundStyle(tribe: TribeSummary) {
  return getCircleBackgroundStyle(tribe, '1400x900');
}

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
  const queryClient = useQueryClient();
  const { data: tribe, isPending } = useQuery(circleQuery(circle, user?._id));
  const isMember = Boolean(tribe && user?.memberIds?.includes(tribe._id));

  const handleMembershipUpdated = (data: MembershipUpdate) => {
    if (data?.tribe) {
      setCachedCircle(queryClient, data.tribe);
    }
    onMembershipUpdated(data);
  };

  if (isPending) {
    return (
      <div className="tw:page-container container-spacer text-muted text-center">
        <LoadingIndicator />
        <br />
        <br />
        <small aria-hidden="true">{t('Wait a moment…') as string}</small>
      </div>
    );
  }

  if (!tribe?._id) {
    return (
      <section className="tw:page-container container-spacer">
        <div className="tw:grid-row">
          <div className="tw:grid-col-12">
            <h2>{t('This circle is not here...') as string}</h2>
            <p className="lead">
              {
                t(
                  "The circle you're seeking isn't here. Check if your address is correct.",
                ) as string
              }
            </p>
            <Button intent="primary" render={<a href="/circles" />}>
              {t('See other circles') as string}
            </Button>
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
  const isAdmin = user?.roles?.includes('admin');
  const isHackersCircle = tribe.slug === 'hackers';
  const hasLocationMap = isHackersCircle || tribe.slug === 'hitchhikers';

  return (
    <>
      <section
        style={{
          position: 'relative',
          ...getTribeHeaderBackgroundStyle(tribe),
        }}
        className={`board tribe-image tribe-header ${user ? '' : 'is-guest'} ${
          hasLocationMap ? 'has-location-map' : ''
        } ${tribe.slug === 'radio' ? 'has-radio-player' : ''}`}
      >
        <div className="tribe-header-info">
          <div className="tw:mx-auto tw:w-full tw:max-w-[1600px] tw:px-6">
            <div className="tw:grid-row no-gutters">
              <div className="tw:grid-col-12">
                <Button
                  variant="link"
                  size="lg"
                  className="tribe-header-back"
                  render={<a href="/circles" />}
                >
                  <i className="icon-left"></i> {t('More circles') as string}
                </Button>
              </div>
            </div>
            <div className="tw:grid-row">
              <div
                className={
                  hasLocationMap
                    ? 'tw:grid-col-12 tw:md:grid-col-5 tw:lg:grid-col-5'
                    : `${
                        user ? 'tw:grid-col-10' : 'tw:grid-col-12'
                      } tw:sm:grid-offset-1 tw:sm:grid-col-7 tw:md:grid-col-6 tw:lg:grid-col-6`
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
                {user && !!tribe.organisers?.length && (
                  <section
                    aria-label={t('Circle organisers')}
                    className="tribe-organisers"
                  >
                    <h3 className="web-section-heading">
                      {t('Circle organisers')}
                    </h3>
                    <ul className="web-section-list">
                      {tribe.organisers.map(organiser => (
                        <li key={organiser.username}>
                          <MemberSearchCard user={organiser} compact />
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {tribe.description && (
                  <RichText
                    className="lead tribe-meta"
                    content={tribe.description}
                    allowLinks
                    allowMarkdownLinks
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
                    {isAdmin && (
                      <Button
                        render={
                          <a
                            href={`/admin/circles/${encodeURIComponent(tribe.slug)}`}
                          />
                        }
                      >
                        {t('Edit circle') as string}
                      </Button>
                    )}
                    {!isAdmin && tribe.canEdit && (
                      <EditCircle
                        key={tribe._id}
                        tribe={tribe}
                        onSave={({ _id, label, description }) =>
                          setCachedCircle(queryClient, {
                            _id,
                            label,
                            description,
                          })
                        }
                      />
                    )}
                    <JoinButton
                      tribe={tribe}
                      user={user}
                      look={{}}
                      activeClassName="circle-membership-active"
                      icon={false}
                      source="circle_page"
                      memberLabel={t("You're a member") as string}
                      onUpdated={handleMembershipUpdated}
                    />
                    <Button
                      intent="primary"
                      render={<a href={`/search?tribe=${tribe.slug}`} />}
                    >
                      {t('Find members') as string}
                    </Button>
                    {wikiUrl && !isHackersCircle && (
                      <Button
                        render={
                          <a
                            href={wikiUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        }
                      >
                        {t('Circle Wiki') as string}
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button
                    intent="primary"
                    size="xl"
                    className="tribe-join"
                    render={<a href={`/signup?tribe=${tribe.slug}`} />}
                  >
                    {
                      t('Join {{label}} on Trustroots', {
                        label: tribe.label,
                      }) as string
                    }
                  </Button>
                )}
                {!user && (
                  <Button
                    variant="link"
                    size="lg"
                    className="tribe-readmore"
                    render={<a href={`/?circle=${tribe.slug}`} />}
                  >
                    <i className="icon-right"></i>{' '}
                    {t('How does it work?') as string}
                  </Button>
                )}
                {wikiUrl && !user && !isHackersCircle && (
                  <Button
                    variant="link"
                    size="lg"
                    className="tribe-readmore"
                    render={
                      <a
                        href={wikiUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                  >
                    {t('Circle Wiki') as string}
                  </Button>
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
                <div className="tw:grid-col-12 tw:md:grid-col-7 tw:lg:grid-col-7 circle-hero-map">
                  {isHackersCircle ? <HackerspaceMap /> : <HitchhikingMap />}
                </div>
              )}
            </div>
          </div>
          {tribe.attribution && (
            <small className="tw:max-sm:hidden font-brand-light tribe-attribution">
              {t('Photo by') as string}{' '}
              {tribe.attribution_url ? (
                <a href={tribe.attribution_url}>{tribe.attribution}</a>
              ) : (
                tribe.attribution
              )}
            </small>
          )}
        </div>
      </section>
      {tribe.slug === 'radio' && (
        <RadioCircle
          key={user ? `${user._id}:${user.nostrNpub || ''}` : 'visitor'}
          user={user}
        />
      )}
      {tribe.slug === 'hitchhikers' && (
        <TopicChat
          roomName="hitchhikers"
          key={user ? `${user._id}:${user.nostrNpub || ''}` : 'visitor'}
          user={user}
        />
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
          <TopicChat
            roomName="hackers"
            key={user ? `${user._id}:${user.nostrNpub || ''}` : 'visitor'}
            user={user}
          />
        )}
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
              <Button render={<a {...resourceLinkProps} href={wikiUrl} />}>
                {t('Circle Wiki') as string}
              </Button>
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
