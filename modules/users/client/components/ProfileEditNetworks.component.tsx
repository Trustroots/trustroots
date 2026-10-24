import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { nip19 } from 'nostr-tools';

import ProfileEditPage from './ProfileEditPage.component';
import { nostrChallenge, removeSocialAccount, update } from '../api/users.api';
import {
  NostrSigningError,
  signNostrProof,
} from '../services/nostr-proof.client';
import { useAuth } from '@/modules/core/client/react-app/auth';
import type { UserProfile } from '../types';
import { readApiError } from '../utils/api-error';

declare global {
  interface Window {
    nostr?: {
      getPublicKey?: () => Promise<string>;
      signEvent?: (
        event: Record<string, unknown>,
      ) => Promise<Record<string, unknown>>;
    };
  }
}

const LEGACY_SOCIAL_PROVIDERS = ['facebook', 'github', 'twitter'] as const;
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
  const { setUser } = useAuth();
  const [draftUser, setDraftUser] = useState({ ...user });
  const [hasChanges, setHasChanges] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [savedNpub, setSavedNpub] = useState(normalizeNpub(user.nostrNpub));
  const [suggestedNpub, setSuggestedNpub] = useState('');
  const [signingMethod, setSigningMethod] = useState<
    'browser' | 'bunker' | 'external'
  >('browser');
  const [bunkerUri, setBunkerUri] = useState('');
  const [challengeJson, setChallengeJson] = useState('');
  const [signedJson, setSignedJson] = useState('');
  const [authUrl, setAuthUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => operation.current?.abort(), []);

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
    if ('nostrNpub' in changes) {
      setChallengeJson('');
      setSignedJson('');
    }
    setDraftUser(previous => ({ ...previous, ...changes }));
    setHasChanges(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const npub = normalizeNpub(draftUser.nostrNpub);
    if (!NPUB_PATTERN.test(npub)) {
      setStatusMessage(
        t(
          'Invalid nostr key. Please provide your npub (public key) starting with "npub". Never use your nsec (secret key).',
        ),
      );
      return;
    }

    setStatusMessage('');
    setAuthUrl('');
    setBusy(true);
    operation.current = new AbortController();

    try {
      let nostrProof: unknown;
      if (npub && npub !== savedNpub) {
        if (signingMethod === 'external') {
          try {
            nostrProof = JSON.parse(signedJson);
          } catch {
            throw new NostrSigningError(
              'Paste the signed event JSON from your signing tool.',
            );
          }
        } else {
          const event = await nostrChallenge(npub);
          nostrProof = await signNostrProof(
            event,
            npub,
            signingMethod,
            bunkerUri,
            setAuthUrl,
            operation.current.signal,
          );
        }
      }
      const savedUser = await update({
        nostrNpub: npub,
        ...(nostrProof === undefined ? {} : { nostrProof }),
        extSitesCouchers: draftUser.extSitesCouchers,
        extSitesBW: draftUser.extSitesBW,
        extSitesCS: draftUser.extSitesCS,
        extSitesWS: draftUser.extSitesWS,
        extSitesServas: draftUser.extSitesServas,
      });
      setUser(current => ({ ...current, ...savedUser }));
      setDraftUser({ ...savedUser });
      setSavedNpub(normalizeNpub(savedUser.nostrNpub));
      setHasChanges(false);
      setStatusMessage(t('Hospitality networks updated.'));
    } catch (error: unknown) {
      const { message } = readApiError(error);
      setStatusMessage(
        message ||
          (error instanceof NostrSigningError
            ? t(error.message)
            : t('Something went wrong. Please try again!')),
      );
    } finally {
      setBusy(false);
      setAuthUrl('');
    }
  }

  async function prepareExternalChallenge() {
    setBusy(true);
    setSignedJson('');
    setStatusMessage('');
    try {
      setChallengeJson(
        JSON.stringify(
          await nostrChallenge(normalizeNpub(draftUser.nostrNpub)),
          null,
          2,
        ),
      );
    } catch (error) {
      setStatusMessage(
        readApiError(error).message ||
          t('Something went wrong. Please try again!'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveSocialAccount(provider: string) {
    try {
      const savedUser = await removeSocialAccount(provider);
      setUser(current => ({ ...current, ...savedUser }));
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
        <fieldset disabled={busy}>
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
                        onClick={() =>
                          updateDraft({ nostrNpub: suggestedNpub })
                        }
                      >
                        {draftUser.nostrNpub
                          ? t('Replace with this npub')
                          : t('Use this npub')}
                      </button>
                    </p>
                  )}
                  {normalizeNpub(draftUser.nostrNpub) &&
                    normalizeNpub(draftUser.nostrNpub) !== savedNpub && (
                      <div className="nostr-ownership-proof">
                        <p className="help-block">
                          {t(
                            'Prove ownership by signing a fresh challenge. Never enter your secret key. The proof is not published.',
                          )}
                        </p>
                        <label htmlFor="nostrSigningMethod">
                          {t('Signing method')}
                        </label>
                        <select
                          id="nostrSigningMethod"
                          className="form-control"
                          value={signingMethod}
                          onChange={event =>
                            setSigningMethod(
                              event.target.value as typeof signingMethod,
                            )
                          }
                        >
                          <option value="browser">
                            {t('Browser signer (NIP-07)')}
                          </option>
                          <option value="bunker">
                            {t('Remote signer (NIP-46)')}
                          </option>
                          <option value="external">
                            {t('Sign with another tool')}
                          </option>
                        </select>
                        {signingMethod === 'bunker' && (
                          <>
                            <label htmlFor="nostrBunker">
                              {t('Bunker URI')}
                            </label>
                            <input
                              id="nostrBunker"
                              className="form-control"
                              type="password"
                              autoComplete="off"
                              value={bunkerUri}
                              onChange={event =>
                                setBunkerUri(event.target.value)
                              }
                              placeholder="bunker://"
                            />
                          </>
                        )}
                        {signingMethod === 'external' && (
                          <>
                            <button
                              type="button"
                              className="btn btn-default"
                              onClick={prepareExternalChallenge}
                            >
                              {t('Create signing challenge')}
                            </button>
                            {challengeJson && (
                              <>
                                <label htmlFor="nostrChallenge">
                                  {t('Challenge to sign')}
                                </label>
                                <textarea
                                  id="nostrChallenge"
                                  className="form-control"
                                  readOnly
                                  value={challengeJson}
                                  rows={8}
                                />
                                <label htmlFor="nostrSignedEvent">
                                  {t('Signed event JSON')}
                                </label>
                                <textarea
                                  id="nostrSignedEvent"
                                  className="form-control"
                                  value={signedJson}
                                  onChange={event =>
                                    setSignedJson(event.target.value)
                                  }
                                  rows={5}
                                />
                              </>
                            )}
                          </>
                        )}
                      </div>
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
                      id: 'extSitesServas',
                      label: 'servas.org/',
                      field: 'extSitesServas',
                      testUrl: (value: string) => `https://servas.org/${value}`,
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
                      | 'extSitesWS'
                      | 'extSitesServas';
                    testUrl: (value: string) => string;
                  }>
                ).map(field => {
                  const fieldValue = draftUser[field.field] as
                    string | undefined;
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
                          ) =>
                            updateDraft({ [field.field]: event.target.value })
                          }
                        />
                        {fieldValue && field.field !== 'extSitesCS' && (
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
                      {field.field === 'extSitesCS' && fieldValue && (
                        <p className="help-block text-break">
                          {field.testUrl(fieldValue)}
                        </p>
                      )}
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
        </fieldset>
      </form>

      {authUrl && (
        <p>
          <a href={authUrl} target="_blank" rel="noopener noreferrer">
            {t('Authorise the remote signer')}
          </a>
        </p>
      )}
      {busy && <p role="status">{t('Waiting for signing or saving…')}</p>}

      {statusMessage && (
        <p className="help-block" role="status">
          {statusMessage}
        </p>
      )}
    </ProfileEditPage>
  );
}
