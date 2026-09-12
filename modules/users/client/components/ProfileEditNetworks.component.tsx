import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { nip19 } from 'nostr-tools';

import ProfileEditPage from './ProfileEditPage.component';
import { removeSocialAccount, update } from '../api/users.api';
import { useAuth } from '@/modules/core/client/react-app/auth';
import type { UserProfile } from '../types';
import { readApiError } from '../utils/api-error';
import NostrootsOnboarding from '@/modules/core/client/components/NostrootsOnboarding.component';

declare global {
  interface Window {
    nostr?: { getPublicKey?: () => Promise<string> };
  }
}

const LEGACY_SOCIAL_PROVIDERS = ['facebook', 'github', 'twitter'];
const NPUB_PATTERN = /^(|npub1[ac-hj-np-z02-9]+)$/i;

function normalizeNpub(npub?: string) {
  return (npub || '').trim().toLowerCase();
}

function isWarmshowersId(value: string) {
  if (Number.isNaN(Number(value))) {
    return false;
  }

  const parsed = parseFloat(value);
  return (parsed | 0) === parsed;
}

export default function ProfileEditNetworks({ user }: { user: UserProfile }) {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  const { user: viewer, setUser } = useAuth() as {
    user: UserProfile;
    setUser: (user: UserProfile) => void;
  };
  const [draftUser, setDraftUser] = useState({ ...user });
  const [hasChanges, setHasChanges] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [suggestedNpub, setSuggestedNpub] = useState('');

  useEffect(() => {
    if (!window.nostr || typeof window.nostr.getPublicKey !== 'function') {
      return;
    }

    window.nostr
      .getPublicKey()
      .then(publicKey => setSuggestedNpub(nip19.npubEncode(publicKey)))
      .catch(() => undefined);
  }, []);

  function updateDraft(changes: Partial<UserProfile>) {
    setDraftUser(previous => ({ ...previous, ...changes }));
    setHasChanges(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!NPUB_PATTERN.test(draftUser.nostrNpub || '')) {
      setStatusMessage(
        t(
          'Invalid nostr key. Please provide your npub (public key) starting with "npub". Never use your nsec (secret key).',
        ),
      );
      return;
    }

    setStatusMessage('');

    try {
      const savedUser = await update(draftUser);
      setUser(savedUser);
      setDraftUser({ ...savedUser });
      setHasChanges(false);
      setStatusMessage(t('Hospitality networks updated.'));
    } catch (error: unknown) {
      const { message } = readApiError(error);
      setStatusMessage(message || t('Something went wrong. Please try again!'));
    }
  }

  async function handleRemoveSocialAccount(provider: string) {
    try {
      const savedUser = await removeSocialAccount(provider);
      setUser(savedUser);
      setDraftUser({ ...savedUser });
      setStatusMessage(
        t('Successfully deleted the {{provider}} connection.', { provider }),
      );
    } catch (error: unknown) {
      const { message } = readApiError(error);
      setStatusMessage(
        message ||
          t(
            'Something went wrong. Try again or contact us to delete this connection.',
          ),
      );
    }
  }

  const hasNip07Suggestion =
    suggestedNpub &&
    normalizeNpub(draftUser.nostrNpub) !== normalizeNpub(suggestedNpub);

  const legacyAccounts = LEGACY_SOCIAL_PROVIDERS.filter(
    provider => draftUser.additionalProvidersData?.[provider],
  );

  return (
    <ProfileEditPage user={user}>
      <form onSubmit={handleSubmit} autoComplete="off">
        <div className="panel panel-default">
          <div className="panel-heading">{t('Elsewhere')}</div>
          <div className="panel-body">
            <div className="extsites nostroots-network">
              <h4>
                <a
                  href="https://nos.trustroots.org"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Nostroots
                </a>
              </h4>
              <NostrootsOnboarding
                username={viewer.username}
                source="network-settings"
                linkRef={undefined}
              />
              <div className="form-group">
                <div className="input-group">
                  <label className="input-group-addon" htmlFor="nostrNpub">
                    npub:
                  </label>
                  <input
                    id="nostrNpub"
                    type="text"
                    className="form-control"
                    value={draftUser.nostrNpub || ''}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      updateDraft({ nostrNpub: event.target.value })
                    }
                    placeholder="npub"
                    aria-label={t('nostr npub')}
                  />
                </div>
                {hasNip07Suggestion && (
                  <p className="help-block nostr-nip07-suggestion">
                    {t('Your browser Nostr extension suggests')}{' '}
                    <code>{suggestedNpub}</code>{' '}
                    <button
                      type="button"
                      className="btn btn-default btn-xs"
                      onClick={() => updateDraft({ nostrNpub: suggestedNpub })}
                    >
                      {draftUser.nostrNpub
                        ? t('Replace with this npub')
                        : t('Use this npub')}
                    </button>
                  </p>
                )}
              </div>
            </div>

            <div className="extsites">
              <h4>{t('Other hospitality networks')}</h4>
              {(
                [
                  {
                    id: 'extSitesCouchers',
                    label: 'couchers.org/user/',
                    field: 'extSitesCouchers',
                    testUrl: (value: string) =>
                      `https://couchers.org/user/${value}`,
                  },
                  {
                    id: 'extSitesBW',
                    label: 'bewelcome.org/members/',
                    field: 'extSitesBW',
                    testUrl: (value: string) =>
                      `https://www.bewelcome.org/members/${value}`,
                  },
                  {
                    id: 'extSitesCS',
                    label: 'couchsurfing.com/people/',
                    field: 'extSitesCS',
                    testUrl: (value: string) =>
                      `https://www.couchsurfing.com/people/${value}`,
                  },
                  {
                    id: 'extSitesWS',
                    label: 'warmshowers.org/user/',
                    field: 'extSitesWS',
                    testUrl: (value: string) =>
                      `https://www.warmshowers.org/${
                        isWarmshowersId(value) ? 'user' : 'users'
                      }/${value}`,
                  },
                ] as Array<{
                  id: string;
                  label: string;
                  field:
                    | 'extSitesCouchers'
                    | 'extSitesBW'
                    | 'extSitesCS'
                    | 'extSitesWS';
                  testUrl: (value: string) => string;
                }>
              ).map(field => {
                const fieldValue = draftUser[field.field] as string | undefined;
                return (
                  <div className="form-group" key={field.id}>
                    <div className="input-group">
                      <label className="input-group-addon" htmlFor={field.id}>
                        {field.label}
                      </label>
                      <input
                        id={field.id}
                        type="text"
                        className="form-control"
                        value={fieldValue || ''}
                        onChange={(
                          event: React.ChangeEvent<HTMLInputElement>,
                        ) => updateDraft({ [field.field]: event.target.value })}
                      />
                      {fieldValue && (
                        <span className="input-group-btn">
                          <a
                            href={field.testUrl(fieldValue)}
                            target="_blank"
                            className="btn btn-primary"
                            rel="noopener noreferrer"
                          >
                            <small>{t('Test')}</small>
                          </a>
                        </span>
                      )}
                    </div>
                    {field.field === 'extSitesWS' &&
                      draftUser.extSitesWS &&
                      !isWarmshowersId(draftUser.extSitesWS) && (
                        <p className="help-block text-warning">
                          {t(
                            'This should be your numeric user id, not username.',
                          )}
                        </p>
                      )}
                  </div>
                );
              })}
            </div>

            <p>
              <button
                type="submit"
                className="btn btn-lg btn-primary profile-editor-save"
                disabled={!hasChanges}
              >
                {t('Save')}
              </button>
            </p>

            {legacyAccounts.length > 0 && (
              <div className="legacy-social-connections">
                <hr />
                <h4>{t('Legacy connections')}</h4>
                <p className="text-muted">
                  {t(
                    'New social account connections are no longer supported. You can delete previously stored connection data here.',
                  )}
                </p>
                <ul className="list-unstyled">
                  {legacyAccounts.map(provider => (
                    <li key={provider}>
                      <span className="legacy-social-provider text-capitalize">
                        {provider} <small>{t('Legacy')}</small>
                      </span>{' '}
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => handleRemoveSocialAccount(provider)}
                      >
                        {t('Delete')}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="panel-footer">
            <small className="text-muted">
              {t(
                'Adding links to other hospitality networks or a Nostr public key is absolutely optional. We will never send your profile data to these services.',
              )}
            </small>
          </div>
        </div>
      </form>

      {statusMessage && (
        <p className="help-block" role="status">
          {statusMessage}
        </p>
      )}
    </ProfileEditPage>
  );
}

ProfileEditNetworks.propTypes = {
  user: PropTypes.object.isRequired,
};
