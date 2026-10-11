import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { nip19 } from 'nostr-tools';

import ProfileEditPage from './ProfileEditPage.component';
import * as usersApi from '../api/users.api';
import { removeSocialAccount, update } from '../api/users.api';
import { useAuth } from '@/modules/core/client/react-app/auth';
import type { UserProfile } from '../types';
import { readApiError } from '../utils/api-error';
import {
  buildNip55Uri,
  buildNostrConnectUri,
  connectBunkerSigner,
  connectNostrConnectSigner,
  DEFAULT_NOSTR_RELAY,
  getNip07Signer,
  isSignedNostrEvent,
  NOSTR_SIGNER_TIMEOUT_MS,
  parseNip55Result,
  validateNostrRelays,
  type NostrSigner,
} from '../services/nostr-signers.client';

const LEGACY_SOCIAL_PROVIDERS = ['facebook', 'github', 'twitter'] as const;
const NPUB_PATTERN = /^(|npub1[ac-hj-np-z02-9]+)$/i;

function normalizeNpub(npub?: string) {
  return (npub || '').trim().toLowerCase();
}

function decodeNostrPublicKey(value: string): string {
  const decoded = value.startsWith('npub1')
    ? nip19.decode(value)
    : { type: 'hex', data: value };
  if (decoded.type !== 'npub' && decoded.type !== 'hex') {
    throw new Error('The signer returned an invalid public key.');
  }
  const data: unknown = decoded.data;
  const hex =
    data instanceof Uint8Array
      ? Array.from(data, byte => byte.toString(16).padStart(2, '0')).join('')
      : data;
  if (typeof hex !== 'string' || !/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error('The signer returned an invalid public key.');
  }
  return hex;
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
  const { setUser, user: authUser } = useAuth();
  const [draftUser, setDraftUser] = useState({ ...user });
  const [savedNpub, setSavedNpub] = useState(user.nostrNpub || '');
  const [verifiedAt, setVerifiedAt] = useState(user.nostrVerifiedAt || '');
  const [hasChanges, setHasChanges] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [suggestedNpub, setSuggestedNpub] = useState('');
  const [bunkerInput, setBunkerInput] = useState('');
  const [relayInput, setRelayInput] = useState('');
  const [connectUri, setConnectUri] = useState('');
  const [connectQr, setConnectQr] = useState('');
  const [nip55Uri, setNip55Uri] = useState('');
  const [signerStatus, setSignerStatus] = useState('');
  const [authUrl, setAuthUrl] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPreparingNip55, setIsPreparingNip55] = useState(false);
  const signerRef = useRef<NostrSigner | null>(null);
  const connectSecretRef = useRef<Uint8Array | null>(null);
  const connectAbortRef = useRef<AbortController | null>(null);
  const connectTimeoutRef = useRef<number | null>(null);
  const nip55TimeoutRef = useRef<number | null>(null);
  const nip46GenerationRef = useRef(0);
  const nip55GenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const authUserRef = useRef(authUser);
  const savedNpubRef = useRef(savedNpub);
  const verificationCandidateRef = useRef<{
    userId: string;
    npub: string;
    verifiedAt?: string;
  } | null>(null);
  authUserRef.current = authUser;
  savedNpubRef.current = savedNpub;
  const hasSavedKey =
    NPUB_PATTERN.test(savedNpub) && savedNpub.startsWith('npub1');
  const keyIsUnchanged =
    normalizeNpub(draftUser.nostrNpub) === normalizeNpub(savedNpub);
  const isVerified = Boolean(verifiedAt && hasSavedKey && keyIsUnchanged);

  function applyVerifiedProfile(verified: {
    _id: string;
    nostrNpub?: string;
    nostrVerifiedAt?: string;
  }) {
    const currentAuthUser = authUserRef.current;
    const expectedNpub = normalizeNpub(savedNpubRef.current);
    const authNpub =
      typeof currentAuthUser?.nostrNpub === 'string'
        ? currentAuthUser.nostrNpub
        : '';
    if (
      !mountedRef.current ||
      currentAuthUser?._id !== user._id ||
      normalizeNpub(verified.nostrNpub) !== expectedNpub ||
      normalizeNpub(authNpub) !== expectedNpub
    ) {
      return;
    }
    verificationCandidateRef.current = {
      userId: user._id,
      npub: expectedNpub,
      verifiedAt: verified.nostrVerifiedAt,
    };
    setUser(current => {
      if (
        !current ||
        current._id !== user._id ||
        normalizeNpub(
          typeof current.nostrNpub === 'string' ? current.nostrNpub : '',
        ) !== expectedNpub
      ) {
        return current;
      }
      return { ...current, nostrVerifiedAt: verified.nostrVerifiedAt };
    });
  }

  function closeSigner() {
    nip46GenerationRef.current += 1;
    connectAbortRef.current?.abort();
    connectAbortRef.current = null;
    if (connectTimeoutRef.current !== null) {
      window.clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    void signerRef.current?.close();
    signerRef.current = null;
    connectSecretRef.current?.fill(0);
    connectSecretRef.current = null;
    setIsConnecting(false);
    setConnectUri('');
    setConnectQr('');
    setAuthUrl('');
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      nip46GenerationRef.current += 1;
      nip55GenerationRef.current += 1;
      connectAbortRef.current?.abort();
      if (connectTimeoutRef.current !== null) {
        window.clearTimeout(connectTimeoutRef.current);
      }
      if (nip55TimeoutRef.current !== null) {
        window.clearTimeout(nip55TimeoutRef.current);
      }
      void signerRef.current?.close();
      connectSecretRef.current?.fill(0);
    };
  }, []);

  useEffect(() => {
    const extension = window.nostr;
    if (typeof extension?.getPublicKey !== 'function') return;
    extension
      .getPublicKey()
      .then(publicKey => setSuggestedNpub(nip19.npubEncode(publicKey)))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const candidate = verificationCandidateRef.current;
    if (!candidate) return;
    const currentAuthUser = authUserRef.current;
    const currentNpub =
      typeof currentAuthUser?.nostrNpub === 'string'
        ? currentAuthUser.nostrNpub
        : '';
    if (
      currentAuthUser?._id === candidate.userId &&
      normalizeNpub(currentNpub) === candidate.npub &&
      currentAuthUser.nostrVerifiedAt === candidate.verifiedAt
    ) {
      setVerifiedAt(candidate.verifiedAt || '');
      verificationCandidateRef.current = null;
    } else if (
      currentAuthUser?._id !== candidate.userId ||
      normalizeNpub(currentNpub) !== candidate.npub
    ) {
      verificationCandidateRef.current = null;
    }
  }, [authUser, savedNpub, user._id]);

  async function acceptPublicKey(publicKey: string) {
    const hex = decodeNostrPublicKey(publicKey);
    setSuggestedNpub(nip19.npubEncode(hex));
    setSignerStatus(t('Review the suggested npub and choose Use this npub.'));
  }

  async function startNip07Import() {
    setSignerStatus('');
    try {
      if (!window.nostr || typeof window.nostr.getPublicKey !== 'function') {
        throw new Error('A NIP-07 browser extension was not found.');
      }
      await acceptPublicKey(await window.nostr.getPublicKey());
    } catch (error: unknown) {
      setSignerStatus(
        error instanceof Error
          ? t(error.message)
          : t('Could not read a key from the browser extension.'),
      );
    }
  }

  async function startNip46(useGeneratedUri: boolean, verifyKey = false) {
    closeSigner();
    const generation = ++nip46GenerationRef.current;
    setIsConnecting(true);
    setSignerStatus(t('Waiting for NIP-46 signer…'));
    setAuthUrl('');
    try {
      const relays = validateNostrRelays(
        relayInput.split(/[\s,]+/).filter(Boolean).length
          ? relayInput.split(/[\s,]+/).filter(Boolean)
          : [DEFAULT_NOSTR_RELAY],
      );
      let session: ReturnType<typeof buildNostrConnectUri> | undefined;
      if (useGeneratedUri) {
        session = buildNostrConnectUri(relays);
        connectSecretRef.current = session.secretKey;
        setConnectUri(session.uri);
        const qr = await import('qrcode');
        const qrDataUrl = await qr.toDataURL(session.uri, {
          margin: 1,
          width: 240,
        });
        if (generation !== nip46GenerationRef.current) {
          session.secretKey.fill(0);
          return;
        }
        setConnectQr(qrDataUrl);
      }
      const controller = new AbortController();
      connectAbortRef.current = controller;
      connectTimeoutRef.current = window.setTimeout(
        () => controller.abort(),
        NOSTR_SIGNER_TIMEOUT_MS,
      );
      const abortPromise = new Promise<never>((_, reject) => {
        controller.signal.addEventListener(
          'abort',
          () =>
            reject(new Error('NIP-46 connection timed out or was cancelled.')),
          { once: true },
        );
      });
      const onAuth = (url: string) => {
        if (!mountedRef.current || generation !== nip46GenerationRef.current)
          return;
        try {
          const parsed = new URL(url);
          if (
            parsed.protocol === 'https:' &&
            !parsed.username &&
            !parsed.password
          ) {
            setAuthUrl(parsed.toString());
          }
        } catch {
          // Ignore malformed authentication URLs from remote signers.
        }
      };
      const connecting = session
        ? connectNostrConnectSigner(
            session.uri,
            session.secretKey,
            onAuth,
            controller.signal,
          )
        : connectBunkerSigner(
            bunkerInput,
            relayInput.trim() ? relayInput.split(/[\s,]+/).filter(Boolean) : [],
            onAuth,
            controller.signal,
          );
      const signer = await Promise.race([connecting, abortPromise]);
      if (generation !== nip46GenerationRef.current) {
        await signer.close();
        return;
      }
      signerRef.current = signer;
      setConnectUri('');
      setConnectQr('');
      const publicKey = await Promise.race([
        signer.getPublicKey(),
        abortPromise,
      ]);
      if (verifyKey) {
        await verifyWithSigner(signer, publicKey, abortPromise);
      } else {
        await acceptPublicKey(publicKey);
        setSignerStatus(t('NIP-46 signer connected.'));
      }
      setIsConnecting(false);
      connectAbortRef.current = null;
      window.clearTimeout(connectTimeoutRef.current!);
      connectTimeoutRef.current = null;
    } catch (error: unknown) {
      if (generation === nip46GenerationRef.current) {
        closeSigner();
        setSignerStatus(
          error instanceof Error
            ? t(error.message)
            : t('Could not connect to the NIP-46 signer.'),
        );
      }
    }
  }

  async function verifyWithSigner(
    signer: NostrSigner,
    publicKey: string,
    abortPromise?: Promise<never>,
  ) {
    const savedHex = nip19.decode(savedNpub).data;
    if (typeof savedHex !== 'string' || publicKey.toLowerCase() !== savedHex) {
      throw new Error('The signer key does not match the saved profile key.');
    }
    const challenge = usersApi.createNostrVerificationChallenge();
    const { event } = abortPromise
      ? await Promise.race([challenge, abortPromise])
      : await challenge;
    const signing = signer.signEvent(event);
    const signedEvent = abortPromise
      ? await Promise.race([signing, abortPromise])
      : await signing;
    if (!isSignedNostrEvent(signedEvent)) {
      throw new Error('The signer returned an invalid signed event.');
    }
    const verification = usersApi.verifyNostrKey(signedEvent);
    const verified = abortPromise
      ? await Promise.race([verification, abortPromise])
      : await verification;
    applyVerifiedProfile(verified);
    setSignerStatus('');
  }

  async function startNip07Verification() {
    setSignerStatus('');
    try {
      const signer = getNip07Signer();
      if (!signer) {
        throw new Error(
          'A NIP-07 extension with signing support was not found.',
        );
      }
      await verifyWithSigner(signer, await signer.getPublicKey());
    } catch (error: unknown) {
      const { message } = readApiError(error);
      setSignerStatus(
        message ||
          (error instanceof Error
            ? error.message
            : t('Could not verify the saved key.')),
      );
    }
  }

  async function startNip46Verification() {
    if (!signerRef.current) {
      await startNip46(!bunkerInput.trim(), true);
      return;
    }
    connectAbortRef.current?.abort();
    const generation = ++nip46GenerationRef.current;
    setIsConnecting(true);
    const controller = new AbortController();
    connectAbortRef.current = controller;
    connectTimeoutRef.current = window.setTimeout(
      () => controller.abort(),
      NOSTR_SIGNER_TIMEOUT_MS,
    );
    const aborted = new Promise<never>((_, reject) => {
      controller.signal.addEventListener(
        'abort',
        () =>
          reject(new Error('NIP-46 connection timed out or was cancelled.')),
        { once: true },
      );
    });
    try {
      const signer = signerRef.current;
      const publicKey = await Promise.race([signer.getPublicKey(), aborted]);
      await verifyWithSigner(signer, publicKey, aborted);
    } catch (error: unknown) {
      if (generation === nip46GenerationRef.current) {
        if (controller.signal.aborted) closeSigner();
        setSignerStatus(
          error instanceof Error
            ? t(error.message)
            : t('Could not verify the saved key.'),
        );
      }
    } finally {
      if (generation === nip46GenerationRef.current) {
        setIsConnecting(false);
        connectAbortRef.current = null;
        window.clearTimeout(connectTimeoutRef.current!);
        connectTimeoutRef.current = null;
      }
    }
  }

  function startNip55PublicKeyRequest() {
    discardPendingNip55();
    const operationId = crypto.randomUUID();
    nip55GenerationRef.current += 1;
    const pending = {
      operationId,
      userId: user._id,
      expiresAt: Date.now() + NOSTR_SIGNER_TIMEOUT_MS,
      purpose: 'import',
      hasChanges,
      draft: {
        nostrNpub: draftUser.nostrNpub,
        extSitesCouchers: draftUser.extSitesCouchers,
        extSitesBW: draftUser.extSitesBW,
        extSitesCS: draftUser.extSitesCS,
        extSitesWS: draftUser.extSitesWS,
      },
    };
    sessionStorage.setItem('trustroots.nostr.pending', JSON.stringify(pending));
    nip55TimeoutRef.current = window.setTimeout(() => {
      const expired = clearPendingNip55(operationId);
      if (expired && mountedRef.current) {
        setNip55Uri('');
        setSignerStatus(
          t('The Android signer request expired. Please try again.'),
        );
      }
    }, NOSTR_SIGNER_TIMEOUT_MS);
    setNip55Uri(buildNip55Uri('get_public_key', operationId));
    setSignerStatus(t('Open the Android signer, then return to this page.'));
  }

  async function startNip55Verification() {
    discardPendingNip55();
    const generation = ++nip55GenerationRef.current;
    setIsPreparingNip55(true);
    setSignerStatus('');
    try {
      const { event } = await usersApi.createNostrVerificationChallenge();
      if (!mountedRef.current || generation !== nip55GenerationRef.current)
        return;
      let savedHex: string;
      try {
        savedHex = decodeNostrPublicKey(savedNpub);
      } catch {
        throw new Error('The saved Nostr public key is invalid.');
      }
      const operationId = crypto.randomUUID();
      const pending = {
        operationId,
        userId: user._id,
        expiresAt: Date.now() + NOSTR_SIGNER_TIMEOUT_MS,
        purpose: 'verify',
        hasChanges,
        draft: {
          nostrNpub: draftUser.nostrNpub,
          extSitesCouchers: draftUser.extSitesCouchers,
          extSitesBW: draftUser.extSitesBW,
          extSitesCS: draftUser.extSitesCS,
          extSitesWS: draftUser.extSitesWS,
        },
      };
      sessionStorage.setItem(
        'trustroots.nostr.pending',
        JSON.stringify(pending),
      );
      nip55TimeoutRef.current = window.setTimeout(() => {
        const expired = clearPendingNip55(operationId);
        if (expired && mountedRef.current) {
          setNip55Uri('');
          setSignerStatus(
            t('The Android signer request expired. Please try again.'),
          );
        }
      }, NOSTR_SIGNER_TIMEOUT_MS);
      setNip55Uri(buildNip55Uri('sign_event', operationId, event, savedHex));
      setSignerStatus(t('Open the Android signer, then return to this page.'));
    } catch (error: unknown) {
      if (mountedRef.current && generation === nip55GenerationRef.current) {
        const { message } = readApiError(error);
        setSignerStatus(
          message ||
            (error instanceof Error
              ? t(error.message)
              : t('Could not start key verification.')),
        );
      }
    } finally {
      if (mountedRef.current && generation === nip55GenerationRef.current) {
        setIsPreparingNip55(false);
      }
    }
  }

  function clearPendingNip55(operationId: string) {
    try {
      const value = sessionStorage.getItem('trustroots.nostr.pending');
      if (!value) return false;
      const pending = JSON.parse(value) as { operationId?: string };
      if (pending.operationId === operationId) {
        sessionStorage.removeItem('trustroots.nostr.pending');
        return true;
      }
    } catch {
      // Leave malformed or unrelated session state untouched.
    }
    return false;
  }

  function discardPendingNip55() {
    nip55GenerationRef.current += 1;
    const pendingText = sessionStorage.getItem('trustroots.nostr.pending');
    if (pendingText) {
      try {
        const pending = JSON.parse(pendingText) as { operationId?: string };
        if (pending.operationId) clearPendingNip55(pending.operationId);
      } catch {
        sessionStorage.removeItem('trustroots.nostr.pending');
      }
    }
    if (nip55TimeoutRef.current !== null) {
      window.clearTimeout(nip55TimeoutRef.current);
      nip55TimeoutRef.current = null;
    }
    setNip55Uri('');
  }

  async function handleNip55Result(value: string, expectedOperation?: string) {
    const pendingText = sessionStorage.getItem('trustroots.nostr.pending');
    if (!pendingText)
      throw new Error('There is no pending Android signer request.');
    const pending = JSON.parse(pendingText) as {
      operationId: string;
      userId: string;
      expiresAt: number;
      purpose: string;
      hasChanges: boolean;
      draft: Partial<UserProfile>;
    };
    if (expectedOperation && expectedOperation !== pending.operationId) {
      throw new Error(
        'The Android signer response expired or belongs to another request.',
      );
    }
    if (pending.userId !== user._id || pending.expiresAt < Date.now()) {
      clearPendingNip55(pending.operationId);
      throw new Error(
        'The Android signer response expired or belongs to another request.',
      );
    }
    setDraftUser(current => ({ ...current, ...pending.draft }));
    setHasChanges(pending.purpose === 'verify' ? pending.hasChanges : true);
    if (nip55TimeoutRef.current !== null) {
      window.clearTimeout(nip55TimeoutRef.current);
      nip55TimeoutRef.current = null;
    }
    const result = parseNip55Result(value);
    clearPendingNip55(pending.operationId);
    setNip55Uri('');
    if (pending.purpose === 'verify') {
      if (!isSignedNostrEvent(result)) {
        throw new Error('The Android signer did not return a signed event.');
      }
      const verified = await usersApi.verifyNostrKey(result);
      applyVerifiedProfile(verified);
      setSignerStatus('');
    } else if (typeof result === 'string') {
      await acceptPublicKey(result);
    } else if (result && typeof result === 'object' && 'pubkey' in result) {
      await acceptPublicKey(String(result.pubkey));
    } else {
      throw new Error('The Android signer returned an invalid public key.');
    }
  }

  function cancelNip55Request() {
    discardPendingNip55();
    setIsPreparingNip55(false);
    setSignerStatus(t('Android signer request cancelled.'));
  }

  async function copySignerRequest(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setSignerStatus(t('Signer request copied to clipboard.'));
    } catch {
      setSignerStatus(t('Could not copy the signer request.'));
    }
  }

  useEffect(() => {
    if (!user._id) return;
    const pendingText = sessionStorage.getItem('trustroots.nostr.pending');
    if (!pendingText) return;
    try {
      const pending = JSON.parse(pendingText) as {
        userId?: string;
        expiresAt?: number;
      };
      if (
        pending.userId !== user._id ||
        !pending.expiresAt ||
        pending.expiresAt < Date.now()
      ) {
        sessionStorage.removeItem('trustroots.nostr.pending');
      }
    } catch {
      sessionStorage.removeItem('trustroots.nostr.pending');
    }
  }, [user._id]);

  async function importNip55Clipboard() {
    try {
      const value = await navigator.clipboard.readText();
      await handleNip55Result(value);
    } catch (error: unknown) {
      setSignerStatus(
        error instanceof Error
          ? t(error.message)
          : t('Could not import the Android signer result.'),
      );
    }
  }

  useEffect(() => {
    if (!user._id) return;
    const callbackUrl = new URL(window.location.href);
    const operationId = callbackUrl.searchParams.get('nostrOperation');
    const result =
      callbackUrl.searchParams
        .getAll('nostrResult')
        .find(value => value.length > 0) ?? null;
    if (operationId || result) {
      callbackUrl.searchParams.delete('nostrOperation');
      callbackUrl.searchParams.delete('nostrResult');
      window.history.replaceState(
        window.history.state,
        '',
        callbackUrl.toString(),
      );
      if (operationId && result) {
        void handleNip55Result(result, operationId).catch((error: unknown) => {
          setSignerStatus(
            error instanceof Error
              ? t(error.message)
              : t('Could not import the Android signer result.'),
          );
        });
      }
    }
  }, [user._id]);

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
      const savedUser = await update({
        nostrNpub: draftUser.nostrNpub,
        extSitesCouchers: draftUser.extSitesCouchers,
        extSitesBW: draftUser.extSitesBW,
        extSitesCS: draftUser.extSitesCS,
        extSitesWS: draftUser.extSitesWS,
      });
      setUser(current => ({
        ...current,
        ...savedUser,
        nostrVerifiedAt: savedUser.nostrVerifiedAt,
      }));
      setDraftUser({ ...savedUser });
      setSavedNpub(savedUser.nostrNpub || '');
      setVerifiedAt(savedUser.nostrVerifiedAt || '');
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
                <div className="nostr-signer-controls">
                  <button
                    type="button"
                    className="btn btn-default btn-sm"
                    disabled={isConnecting}
                    onClick={startNip07Import}
                  >
                    {t('Use browser extension')}
                  </button>{' '}
                  <button
                    type="button"
                    className="btn btn-default btn-sm"
                    disabled={isConnecting}
                    onClick={() => void startNip46(false)}
                  >
                    {t('Connect with NIP-46')}
                  </button>{' '}
                  <button
                    type="button"
                    className="btn btn-default btn-sm"
                    disabled={isConnecting}
                    onClick={() => void startNip46(true)}
                  >
                    {t('Show Nostr Connect QR')}
                  </button>{' '}
                  <button
                    type="button"
                    className="btn btn-default btn-sm"
                    disabled={isPreparingNip55}
                    onClick={startNip55PublicKeyRequest}
                  >
                    {t('Use Android signer')}
                  </button>
                </div>
                <div className="nostr-signer-settings">
                  <label htmlFor="nostrRelay">{t('NIP-46 relay')}</label>
                  <input
                    id="nostrRelay"
                    type="url"
                    className="form-control"
                    value={relayInput}
                    onChange={event => setRelayInput(event.target.value)}
                    placeholder={DEFAULT_NOSTR_RELAY}
                  />
                  <label htmlFor="nostrBunkerUri">
                    {t('NIP-46 bunker URI')}
                  </label>
                  <input
                    id="nostrBunkerUri"
                    type="text"
                    className="form-control"
                    value={bunkerInput}
                    onChange={event => setBunkerInput(event.target.value)}
                    autoComplete="off"
                  />
                </div>
                {connectUri && (
                  <div className="nostr-connect-pairing" role="status">
                    <p>{t('Scan this QR code with your Nostr signer.')}</p>
                    {connectQr && (
                      <img src={connectQr} alt={t('Nostr Connect QR')} />
                    )}
                    <textarea
                      aria-label={t('Nostr Connect URI')}
                      readOnly
                      value={connectUri}
                    />
                    <button
                      type="button"
                      className="btn btn-default btn-sm"
                      onClick={() => void copySignerRequest(connectUri)}
                    >
                      {t('Copy connection URI')}
                    </button>{' '}
                    <a
                      className="btn btn-default btn-sm"
                      href={connectUri}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('Open in signer')}
                    </a>{' '}
                    <button
                      type="button"
                      className="btn btn-default btn-sm"
                      onClick={closeSigner}
                    >
                      {t('Cancel connection')}
                    </button>
                  </div>
                )}
                {isConnecting && !connectUri && (
                  <button
                    type="button"
                    className="btn btn-default btn-sm"
                    onClick={closeSigner}
                  >
                    {t('Cancel connection')}
                  </button>
                )}
                {signerRef.current && !isConnecting && (
                  <button
                    type="button"
                    className="btn btn-default btn-sm"
                    onClick={closeSigner}
                  >
                    {t('Disconnect NIP-46 signer')}
                  </button>
                )}
                {nip55Uri && (
                  <div className="nostr-android-pairing" role="status">
                    <a className="btn btn-default btn-sm" href={nip55Uri}>
                      {t('Open in Android signer')}
                    </a>{' '}
                    <button
                      type="button"
                      className="btn btn-default btn-sm"
                      onClick={() => void copySignerRequest(nip55Uri)}
                    >
                      {t('Copy signer request')}
                    </button>{' '}
                    <button
                      type="button"
                      className="btn btn-default btn-sm"
                      onClick={() => void importNip55Clipboard()}
                    >
                      {t('Import NIP-55 result from clipboard')}
                    </button>{' '}
                    <button
                      type="button"
                      className="btn btn-default btn-sm"
                      onClick={cancelNip55Request}
                    >
                      {t('Cancel Android signer request')}
                    </button>
                  </div>
                )}
                {isPreparingNip55 && (
                  <button
                    type="button"
                    className="btn btn-default btn-sm"
                    onClick={cancelNip55Request}
                  >
                    {t('Cancel Android signer request')}
                  </button>
                )}
                {authUrl && (
                  <p>
                    <a href={authUrl} target="_blank" rel="noopener noreferrer">
                      {t('Continue signer authentication')}
                    </a>
                  </p>
                )}
                {signerStatus && (
                  <p className="help-block" role="status">
                    {signerStatus}
                  </p>
                )}
                {suggestedNpub && (
                  <p className="help-block nostr-signer-suggestion">
                    {t('Signer suggests')} <code>{suggestedNpub}</code>{' '}
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
                {hasSavedKey && keyIsUnchanged && !isVerified && (
                  <p className="nostr-verify-controls">
                    <button
                      type="button"
                      className="btn btn-default btn-sm"
                      disabled={isConnecting || isPreparingNip55}
                      onClick={() => void startNip07Verification()}
                    >
                      {t('Verify saved key with browser extension')}
                    </button>{' '}
                    <button
                      type="button"
                      className="btn btn-default btn-sm"
                      disabled={isConnecting || isPreparingNip55}
                      onClick={() => void startNip46Verification()}
                    >
                      {t('Verify saved key with NIP-46')}
                    </button>{' '}
                    <button
                      type="button"
                      className="btn btn-default btn-sm"
                      disabled={isConnecting || isPreparingNip55}
                      onClick={() => void startNip55Verification()}
                    >
                      {t('Verify saved key with Android signer')}
                    </button>
                  </p>
                )}
                {isVerified && (
                  <p className="help-block" role="status">
                    {t('Nostr key ownership verified.')}
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
