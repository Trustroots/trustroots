// External dependencies
import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { nip19 } from 'nostr-tools';

// Internal dependencies
import {
  getNetworkName,
  hasConnectedAdditionalSocialAccounts,
  socialAccountLink,
  hitchwikiMapsProfileLink,
  hitchwikiProfileLink,
  warmshowersProfileLink,
} from '../utils/networks';
import { getGender } from '@/modules/core/client/utils/user_info';
import LanguageList from './LanguageList';
import ProfileNostrBadge from './ProfileNostrBadge.component';
import CouchsurfingProfileAction from './CouchsurfingProfileAction';
import type { UserProfile } from '../types';

const PUBLIC_PROVIDER_NAMES = ['facebook', 'github', 'twitter'] as const;

const HITCHWIKI_NETWORKS = [
  { name: 'Hitchwiki', field: 'extSitesHitchwiki', href: hitchwikiProfileLink },
  {
    name: 'Hitchwiki Maps',
    field: 'extSitesHitchwikiMaps',
    href: hitchwikiMapsProfileLink,
  },
] as const;
function npubToHex(npub: string): string | null {
  try {
    const { type, data } = nip19.decode(npub);
    return type === 'npub' && typeof data === 'string' ? data : null;
  } catch {
    return null;
  }
}

export default function ProfileViewBasics({
  profile,
  canOpenCouchsurfing = false,
}: {
  profile: UserProfile & { seen?: string };
  canOpenCouchsurfing?: boolean;
}) {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  const nostrIdentifier =
    profile.username && profile.nostrNpub
      ? `${profile.username}@trustroots.org`
      : profile.nostrNpub || '';
  const nostrDescriptionId = profile.username
    ? `nostr-address-note-${profile.username}`
    : undefined;

  const getBirthdate = (birthdate: string) =>
    t('{{birthdate, age}} years.', { birthdate: new Date(birthdate) });

  const getReplyRate = (replyRate: string) =>
    t('Reply rate {{replyRate}}.', { replyRate });

  const getReplyTime = (replyTime: string) =>
    t('Replies within {{replyTime}}.', { replyTime });

  const getSeenOnline = (seen?: string) => {
    if (seen) {
      return t('Online {{ date, fromNow }}', { date: new Date(seen) });
    }
    return t('Online long ago');
  };

  /*
   * Rendering functions
   */
  const renderReplyData = (replyRate?: string, replyTime?: string) => (
    <div className="profile-sidebar-section text-muted">
      {replyRate && <span>{getReplyRate(replyRate)}</span>}
      {replyTime && (
        <span>
          {replyRate && <br />}
          {getReplyTime(replyTime)}
        </span>
      )}
    </div>
  );

  const renderBirthdateAndGender = (
    birthdate?: string | null,
    gender?: string,
  ) => {
    return (
      <div className="profile-sidebar-section">
        {birthdate && `${getBirthdate(birthdate)} `}
        {gender && `${getGender(gender)}.`}
      </div>
    );
  };

  const renderMemberSince = (created?: string) => {
    const date = new Date(created ?? NaN);
    if (Number.isNaN(date.getTime())) return null;

    return (
      <div className="profile-sidebar-section">
        <time
          dateTime={date.toISOString()}
          title={t('Member since {{date, ll}}', { date })}
        >
          {t('Registered {{date, fromNow}}', { date })}
        </time>
      </div>
    );
  };

  const renderSeenOnline = (seen?: string) => (
    <div className="profile-sidebar-section">
      <span>{getSeenOnline(seen)}</span>
    </div>
  );

  const renderLocationLiving = (locationLiving: string) => (
    <div className="profile-sidebar-section">
      <i className="icon-fw icon-building text-muted" />
      {/* @TODO remove ns (issue #1368) */}
      <Trans ns="users" values={{ locationLiving }}>
        Lives in{' '}
        <a href={`/search?location=${locationLiving}`}>{locationLiving}</a>
      </Trans>
    </div>
  );

  const renderLocationFrom = (locationFrom: string) => (
    <div className="profile-sidebar-section">
      <i className="icon-fw icon-home text-muted"></i>
      {/* @TODO remove ns (issue #1368) */}
      <Trans ns="users" values={{ locationFrom }}>
        From <a href={`/search?location=${locationFrom}`}>{locationFrom}</a>
      </Trans>
    </div>
  );

  const renderLanguages = (languages: string[]) => (
    <div className="profile-sidebar-section">
      <h4>{t('Languages')}</h4>
      <LanguageList
        className="list-unstyled"
        languages={languages}
        languageLevels={profile.languageLevels}
      />
    </div>
  );

  const renderSocialNetworks = (profile: UserProfile) => (
    <div className="profile-sidebar-section">
      <h4 id="profile-networks" aria-label="Member in other networks">
        {t('Elsewhere')}
      </h4>
      <ul
        className="elsewhere-profiles list-unstyled"
        aria-describedby="profile-networks"
      >
        {profile.nostrNpub && (
          <li className="social-profile" title={getNetworkName('nostr')}>
            <img
              className="social-profile-icon nostroots-logo"
              src="/img/external/nostroots-logo.png"
              alt=""
            />
            <a
              target="_blank"
              rel="noopener noreferrer"
              className="social-profile-handle"
              href={`https://nos.trustroots.org/v0/#profile/${encodeURIComponent(
                nostrIdentifier,
              )}`}
              aria-describedby={nostrDescriptionId}
            >
              {getNetworkName('nostr')}
            </a>
            {profile.username && (
              <span id={nostrDescriptionId} className="sr-only">
                {t('Nostr address, not an email address')}
              </span>
            )}
          </li>
        )}
        {profile.additionalProvidersData &&
          PUBLIC_PROVIDER_NAMES.filter(network =>
            Object.prototype.hasOwnProperty.call(
              profile.additionalProvidersData,
              network,
            ),
          ).map(network => {
            const href = socialAccountLink(
              network,
              profile.additionalProvidersData?.[network] || {},
            );
            return (
              network !== 'facebook' && (
                <li
                  className="social-profile"
                  key={network}
                  title={getNetworkName(network)}
                >
                  <i
                    className={`social-profile-icon icon-fw icon-lg icon-${network}`}
                  />
                  <a
                    target={href === '#' ? undefined : '_blank'}
                    rel="noopener noreferrer"
                    className="social-profile-handle"
                    href={href}
                  >
                    {getNetworkName(network)}
                  </a>
                </li>
              )
            );
          })}
        {/* Couchers.org */}
        {profile.extSitesCouchers && (
          <li className="social-profile" title="Couchers.org">
            <i className="social-profile-icon icon-fw icon-lg icon-couchers"></i>
            <a
              target="_blank"
              rel="noopener noreferrer"
              className="social-profile-handle"
              href={`https://couchers.org/user/${profile.extSitesCouchers}`}
            >
              CO: {profile.extSitesCouchers}
            </a>
          </li>
        )}

        {/* BeWelcome */}
        {profile.extSitesBW && (
          <li className="social-profile" title="BeWelcome">
            <i className="social-profile-icon icon-fw icon-lg icon-bw"></i>
            <a
              target="_blank"
              rel="noopener noreferrer"
              className="social-profile-handle"
              href={`https://www.bewelcome.org/members/${profile.extSitesBW}`}
            >
              BW: {profile.extSitesBW}
            </a>
          </li>
        )}

        {/* Couchsurfing */}
        {profile.extSitesCS && (
          <li className="social-profile" title="Couchsurfing">
            {canOpenCouchsurfing ? (
              <CouchsurfingProfileAction
                handle={profile.extSitesCS}
                className="social-profile-handle tw:p-0"
                variant="link"
              >
                CS: {profile.extSitesCS}
              </CouchsurfingProfileAction>
            ) : (
              <span className="social-profile-handle">
                CS: {profile.extSitesCS}
              </span>
            )}
          </li>
        )}
        {profile.extSitesServas && (
          <li className="social-profile" title="Servas">
            <i className="social-profile-icon icon-fw icon-lg icon-link"></i>
            <a
              target="_blank"
              rel="noopener noreferrer"
              className="social-profile-handle"
              href={`https://servas.org/${profile.extSitesServas}`}
            >
              Servas: {profile.extSitesServas}
            </a>
          </li>
        )}
        {HITCHWIKI_NETWORKS.map(({ name, field, href }) => {
          const handle = profile[field];
          return (
            handle && (
              <li className="social-profile" title={name} key={field}>
                <i className="social-profile-icon icon-fw icon-lg icon-link"></i>
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-profile-handle"
                  href={href(handle)}
                >
                  {name}: {handle}
                </a>
              </li>
            )
          );
        })}
        {/* WarmShowers */}
        {profile.extSitesWS && (
          <li className="social-profile" title="Warmshowers">
            <i className="social-profile-icon icon-fw icon-lg icon-warmshowers"></i>
            <a
              target="_blank"
              rel="noopener noreferrer"
              className="social-profile-handle"
              href={warmshowersProfileLink(profile.extSitesWS)}
            >
              Warmshowers
            </a>
          </li>
        )}
      </ul>
    </div>
  );

  return (
    <div>
      {(profile.isVolunteer || profile.isVolunteerAlumni) && (
        <div className="profile-sidebar-section">
          ✨{' '}
          <a href="/team">
            {profile.isVolunteer && t('Trustroots volunteer')}
            {profile.isVolunteerAlumni && t('Trustroots volunteer alumni')}
          </a>
        </div>
      )}

      {profile.isGreeter && (
        <div className="profile-sidebar-section">
          👋 <a href="/team/greeters">{t('Trustroots greeter')}</a>
        </div>
      )}

      {/* reply rate and reply time */}
      {(profile.replyRate || profile.replyTime) &&
        renderReplyData(profile.replyRate, profile.replyTime)}

      {/* birthdate and gender */}
      {(profile.birthdate || profile.gender) &&
        renderBirthdateAndGender(profile.birthdate, profile.gender)}

      {/* member since */}
      {renderMemberSince(profile.created)}
      {/* seen online */}
      {renderSeenOnline(profile.seen)}

      {/* location living */}
      {profile.locationLiving && renderLocationLiving(profile.locationLiving)}

      {/* location from */}
      {profile.locationFrom && renderLocationFrom(profile.locationFrom)}

      {/* languages */}
      {profile.languages?.length ? renderLanguages(profile.languages) : null}

      {/* social networks */}
      {(hasConnectedAdditionalSocialAccounts(profile) ||
        profile.nostrNpub ||
        profile.extSitesCouchers ||
        profile.extSitesBW ||
        profile.extSitesCS ||
        profile.extSitesWS ||
        profile.extSitesServas ||
        profile.extSitesHitchwiki ||
        profile.extSitesHitchwikiMaps) &&
        renderSocialNetworks(profile)}

      {profile.nostrNpub && (
        <ProfileNostrBadge
          key={profile.nostrNpub}
          npubHex={npubToHex(profile.nostrNpub)}
        />
      )}
    </div>
  );
}
