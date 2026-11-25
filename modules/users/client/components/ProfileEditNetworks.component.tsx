import { Input } from '@trustroots/ui/Input';
import { Select } from '@trustroots/ui/Select';
import { Textarea } from '@trustroots/ui/Textarea';
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@trustroots/ui/Button';
import { useTranslation } from 'react-i18next';

import ProfileEditPage from './ProfileEditPage.component';
import CouchsurfingProfileAction from './CouchsurfingProfileAction';
import { nostrChallenge, removeSocialAccount, update } from '../api/users.api';
import {
  hasBrowserNostrSigner,
  NostrSigningError,
  signNostrProof,
  signWithConnectedNostr,
  withConnectedNostr,
  type NostrEventSigner,
} from '../services/nostr-proof.client';
import { publishNostrProfile } from '../services/nostr-profile.client';
import { saveFailureReason, useAnalytics } from '@trustroots/analytics/client';
import { useAuth } from '@/modules/core/client/react-app/auth';
import type { UserProfile } from '../types';
import { readApiError } from '../utils/api-error';
import {
  couchsurfingProfileLink,
  hitchwikiMapsProfileLink,
  hitchwikiProfileLink,
  warmshowersProfileLink,
} from '../utils/networks';

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

export default function ProfileEditNetworks({ user }: { user: UserProfile }) {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  const { setUser } = useAuth();
  const { track } = useAnalytics();
  const [draftUser, setDraftUser] = useState({ ...user });
  const [hasChanges, setHasChanges] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [publicationMessage, setPublicationMessage] = useState('');
  const [savedNpub, setSavedNpub] = useState(normalizeNpub(user.nostrNpub));
  const [browserSignerAvailable, setBrowserSignerAvailable] = useState(
    hasBrowserNostrSigner,
  );
  const [pairing, setPairing] = useState<{ uri: string; qr: string }>();
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
    const detectSigner = () =>
      setBrowserSignerAvailable(hasBrowserNostrSigner());
    window.addEventListener('focus', detectSigner);
    detectSigner();
    return () => window.removeEventListener('focus', detectSigner);
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

    await saveNetworks(async (signal, save) => {
      let proof: unknown;
      if (npub && npub !== savedNpub) {
        if (signingMethod === 'external') {
          try {
            proof = JSON.parse(signedJson);
          } catch {
            throw new NostrSigningError(
              'Paste the signed event JSON from your signing tool.',
            );
          }
        } else {
          const event = await nostrChallenge(npub);
          signal.throwIfAborted();
          await signNostrProof(
            event,
            npub,
            signingMethod,
            bunkerUri,
            setAuthUrl,
            signal,
            save,
          );
          return;
        }
      }
      await save({ npub, proof });
    });
  }

  async function saveNetworks(
    getProof: (
      signal: AbortSignal,
      save: (
        link: { npub: string; proof: unknown },
        sign?: NostrEventSigner,
      ) => Promise<void>,
    ) => Promise<unknown>,
  ) {
    setStatusMessage('');
    let didSave = false;
    await runNetworkOperation(
      signal =>
        getProof(signal, async ({ npub, proof }, sign) => {
          signal.throwIfAborted();
          const savedUser = await update({
            nostrNpub: npub,
            ...(proof === undefined ? {} : { nostrProof: proof }),
            extSitesCouchers: draftUser.extSitesCouchers,
            extSitesBW: draftUser.extSitesBW,
            extSitesCS: draftUser.extSitesCS,
            extSitesWS: draftUser.extSitesWS,
            extSitesServas: draftUser.extSitesServas,
            extSitesHitchwikiMaps: draftUser.extSitesHitchwikiMaps,
            extSitesHitchwiki: draftUser.extSitesHitchwiki,
          });
          setUser(current => ({ ...current, ...savedUser }));
          setDraftUser({ ...savedUser });
          setSavedNpub(normalizeNpub(savedUser.nostrNpub));
          setHasChanges(false);
          setStatusMessage(t('Hospitality networks updated.'));
          track('profile_section_saved', { section: 'networks' });
          didSave = true;
          if (
            sign &&
            savedUser.nostrNpub &&
            savedUser.nostrNpub !== savedNpub
          ) {
            await publishAddress(
              savedUser.username,
              savedUser.nostrNpub,
              sign,
              signal,
            );
          }
        }),
      error => {
        if (didSave) {
          showPublicationError();
          return;
        }
        track('profile_save_failed', {
          section: 'networks',
          reason: saveFailureReason(error),
        });
        const { message } = readApiError(error);
        setStatusMessage(
          message ||
            (error instanceof NostrSigningError
              ? t(error.message)
              : t('Something went wrong. Please try again!')),
        );
      },
    );
  }

  async function runNetworkOperation(
    work: (signal: AbortSignal) => Promise<unknown>,
    onError: (error: unknown) => void,
  ) {
    if (operation.current) return;
    setPublicationMessage('');
    setAuthUrl('');
    setBusy(true);
    const controller = new AbortController();
    operation.current = controller;
    try {
      await work(controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) onError(error);
    } finally {
      controller.abort();
      operation.current = null;
      setBusy(false);
      setAuthUrl('');
      setPairing(undefined);
    }
  }

  function showPublicationError() {
    setPublicationMessage(
      t('Could not publish your Nostr address. You can try again.'),
    );
  }

  async function publishAddress(
    username: string,
    npub: string,
    sign: NostrEventSigner,
    signal: AbortSignal,
  ) {
    const result = await publishNostrProfile(
      { username, nostrNpub: npub },
      sign,
      signal,
    );
    setPublicationMessage(
      result === 'published'
        ? t('Your Trustroots Nostr address is published.')
        : t(
            'Your Trustroots Nostr address is unavailable in the public lookup.',
          ),
    );
  }

  function publishSavedAddress() {
    return runNetworkOperation(
      signal =>
        withConnectedNostr(
          browserSignerAvailable ? 'browser' : 'pair',
          setPairing,
          setAuthUrl,
          signal,
          async (npub, sign) => {
            if (npub !== savedNpub) {
              setPublicationMessage(
                t('The signer public key does not match this npub.'),
              );
              return;
            }
            await publishAddress(draftUser.username, savedNpub, sign, signal);
          },
        ),
      showPublicationError,
    );
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

  function linkNostr() {
    const method = browserSignerAvailable ? 'browser' : 'pair';
    return saveNetworks((signal, save) =>
      signWithConnectedNostr(
        method,
        nostrChallenge,
        setPairing,
        setAuthUrl,
        signal,
        save,
      ),
    );
  }

  const legacyAccounts = LEGACY_SOCIAL_PROVIDERS.filter(
    provider => draftUser.additionalProvidersData?.[provider],
  );
  const hasSavedCouchsurfingHandle = Boolean(user.extSitesCS?.trim());

  return (
    <ProfileEditPage user={user}>
      <form onSubmit={handleSubmit} autoComplete="off">
        {pairing && (
          <div className="panel panel-default">
            <div className="panel-body">
              <p>
                {t(
                  'Scan this QR code with your Nostr signer and approve the connection.',
                )}
              </p>
              <img
                src={pairing.qr}
                width={240}
                height={240}
                alt={t('Remote signer connection QR code')}
              />
              <p>
                <a href={pairing.uri}>{t('Open signer app')}</a>
              </p>
              <Button type="button" onClick={() => operation.current?.abort()}>
                {t('Cancel pairing')}
              </Button>
            </div>
          </div>
        )}
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
                <p>
                  <Button type="button" intent="primary" onClick={linkNostr}>
                    {browserSignerAvailable
                      ? t('Link with browser signer')
                      : t('Connect a Nostr signer')}
                  </Button>
                </p>
                <p className="help-block">
                  {t(
                    'Link a signer to publish your public Trustroots Nostr address to the Trustroots relay.',
                  )}
                </p>
                {savedNpub &&
                  normalizeNpub(draftUser.nostrNpub) === savedNpub && (
                    <p>
                      <Button type="button" onClick={publishSavedAddress}>
                        {t('Publish Nostr address')}
                      </Button>
                    </p>
                  )}
                {publicationMessage && (
                  <p className="help-block" role="status">
                    {publicationMessage}
                  </p>
                )}
                <div className="form-group">
                  <div data-slot="input-group" className="tw:input-group">
                    <label
                      className="tw:flex tw:items-center tw:border-y tw:border-solid tw:border-[#ced4da] tw:bg-white tw:pe-[5px] tw:py-1.5 tw:text-[#333] tw:sm:pe-0"
                      htmlFor="nostrNpub"
                    >
                      npub:
                    </label>
                    <Input
                      id="nostrNpub"
                      type="text"
                      value={draftUser.nostrNpub || ''}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                        updateDraft({ nostrNpub: event.target.value })
                      }
                      placeholder="npub"
                      aria-label={t('nostr npub')}
                    />
                  </div>
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
                        <Select
                          id="nostrSigningMethod"
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
                        </Select>
                        {signingMethod === 'bunker' && (
                          <>
                            <label htmlFor="nostrBunker">
                              {t('Bunker URI')}
                            </label>
                            <Input
                              id="nostrBunker"
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
                            <Button
                              type="button"
                              onClick={prepareExternalChallenge}
                            >
                              {t('Create signing challenge')}
                            </Button>
                            {challengeJson && (
                              <>
                                <label htmlFor="nostrChallenge">
                                  {t('Challenge to sign')}
                                </label>
                                <Textarea
                                  id="nostrChallenge"
                                  fieldSize="md"
                                  readOnly
                                  value={challengeJson}
                                  rows={8}
                                />
                                <label htmlFor="nostrSignedEvent">
                                  {t('Signed event JSON')}
                                </label>
                                <Textarea
                                  id="nostrSignedEvent"
                                  fieldSize="md"
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
                      testUrl: couchsurfingProfileLink,
                    },
                    {
                      id: 'extSitesServas',
                      label: 'servas.org/',
                      field: 'extSitesServas',
                      testUrl: (value: string) => `https://servas.org/${value}`,
                    },
                    {
                      id: 'extSitesHitchwiki',
                      label: 'hitchwiki.org/en/User:',
                      field: 'extSitesHitchwiki',
                      testUrl: hitchwikiProfileLink,
                    },
                    {
                      id: 'extSitesHitchwikiMaps',
                      label: 'maps.hitchwiki.org/account/',
                      field: 'extSitesHitchwikiMaps',
                      testUrl: hitchwikiMapsProfileLink,
                    },
                    {
                      id: 'extSitesWS',
                      label: 'app.warmshowers.org/profiles/',
                      field: 'extSitesWS',
                      testUrl: warmshowersProfileLink,
                    },
                  ] as Array<{
                    id: string;
                    label: string;
                    field:
                      | 'extSitesCouchers'
                      | 'extSitesBW'
                      | 'extSitesCS'
                      | 'extSitesWS'
                      | 'extSitesServas'
                      | 'extSitesHitchwiki'
                      | 'extSitesHitchwikiMaps';
                    testUrl: (value: string) => string;
                  }>
                ).map(field => {
                  const fieldValue = draftUser[field.field] as
                    | string
                    | undefined;
                  return (
                    <div className="form-group" key={field.id}>
                      <div data-slot="input-group" className="tw:input-group">
                        <label
                          className="tw:flex tw:items-center tw:border-y tw:border-solid tw:border-[#ced4da] tw:bg-white tw:pe-[5px] tw:py-1.5 tw:text-[#333] tw:sm:pe-0"
                          htmlFor={field.id}
                        >
                          {field.label}
                        </label>
                        <Input
                          id={field.id}
                          type="text"
                          value={fieldValue || ''}
                          onChange={(
                            event: React.ChangeEvent<HTMLInputElement>,
                          ) =>
                            updateDraft({ [field.field]: event.target.value })
                          }
                        />
                        {fieldValue && field.field !== 'extSitesCS' && (
                          <span className="input-group-btn">
                            <Button
                              intent="primary"
                              render={
                                <a
                                  href={field.testUrl(fieldValue)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                />
                              }
                            >
                              <small>{t('Test')}</small>
                            </Button>
                          </span>
                        )}
                        {field.field === 'extSitesCS' &&
                          hasSavedCouchsurfingHandle &&
                          fieldValue?.trim() && (
                            <span className="input-group-btn">
                              <CouchsurfingProfileAction
                                handle={fieldValue}
                                intent="primary"
                              >
                                <small>{t('Test')}</small>
                              </CouchsurfingProfileAction>
                            </span>
                          )}
                      </div>
                      {field.field === 'extSitesCS' &&
                        !hasSavedCouchsurfingHandle &&
                        fieldValue?.trim() && (
                          <p className="help-block text-break">
                            {field.testUrl(fieldValue)}
                          </p>
                        )}
                      {field.field === 'extSitesWS' && (
                        <p className="help-block">
                          {t(
                            'Copy the profile ID from your Warmshowers profile URL.',
                          )}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <p>
                <Button
                  type="submit"
                  intent="primary"
                  size="lg"
                  className="profile-editor-save"
                  disabled={!hasChanges}
                >
                  {t('Save')}
                </Button>
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
                        <Button
                          type="button"
                          intent="danger"
                          size="sm"
                          onClick={() => handleRemoveSocialAccount(provider)}
                        >
                          {t('Delete')}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="panel-footer">
              <small className="text-muted">
                {t(
                  'Adding links to other hospitality networks or a Nostr public key is optional.',
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
