import { publisher, zapstoreRelease } from './android-release-metadata.mts';

export interface Candidate {
  appId: string;
  version: string;
  versionCode: number;
  filename: string;
  url: string;
  sha256: string;
  size: number;
  certificate: string;
  minSdk: number;
  targetSdk: number;
  platforms: string[];
  published: string;
}
export interface UnsignedEvent {
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
}
export interface SignedEvent extends UnsignedEvent {
  id: string;
  sig: string;
}
export interface NostrSigner {
  getPublicKey(): Promise<string>;
  signEvent(event: UnsignedEvent): Promise<SignedEvent>;
}
export interface PublishOptions {
  signer?: NostrSigner;
  fetcher?: typeof fetch;
  Socket?: typeof WebSocket;
  status?: (text: string) => void;
}
const safeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value);
const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'Publication was interrupted. Please retry.';

export const certificate =
  '09172995e8abe0c2e0998c08d8795e093f416b728185c16b16b25ebe7968ff46';
export const relayUrl = 'wss://relay.zapstore.dev';
export const cdnUrl = 'https://cdn.zapstore.dev';
const appId = 'org.trustroots.android';
const hex = (value: ArrayBuffer) =>
  Array.from(new Uint8Array(value), byte =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
export const digest = async (bytes: BufferSource) =>
  hex(await crypto.subtle.digest('SHA-256', bytes));

export function validateCandidate(value: unknown): Candidate {
  if (!value || typeof value !== 'object')
    throw new Error(
      'No verified preview is prepared for browser publication yet.',
    );
  const candidate = value as Partial<Candidate>;
  if (
    candidate?.appId !== appId ||
    candidate.certificate !== certificate ||
    typeof candidate.version !== 'string' ||
    !/^0\.1-\d{8}-\d{4}$/.test(candidate.version) ||
    !safeInteger(candidate.versionCode) ||
    candidate.versionCode < 100000 ||
    typeof candidate.sha256 !== 'string' ||
    !/^[0-9a-f]{64}$/.test(candidate.sha256) ||
    !safeInteger(candidate.size) ||
    candidate.size <= 0 ||
    candidate.size > 100 * 1024 * 1024 ||
    !safeInteger(candidate.minSdk) ||
    !safeInteger(candidate.targetSdk) ||
    candidate.minSdk < 1 ||
    candidate.targetSdk < candidate.minSdk ||
    !Array.isArray(candidate.platforms) ||
    !candidate.platforms.includes('android-arm64-v8a') ||
    candidate.platforms.some(
      platform =>
        !/^android-(arm64-v8a|armeabi-v7a|x86|x86_64)$/.test(platform),
    ) ||
    typeof candidate.published !== 'string' ||
    !Number.isFinite(Date.parse(candidate.published))
  ) {
    throw new Error(
      'The prepared APK metadata is invalid. Wait for a new docs deployment.',
    );
  }
  const filename = `trustroots-android-${candidate.version}.apk`;
  const url = `https://github.com/Trustroots/trustroots/releases/download/android-preview-${candidate.versionCode}-v${candidate.version}/${filename}`;
  if (candidate.filename !== filename || candidate.url !== url) {
    throw new Error('The prepared APK does not match the Trustroots release.');
  }
  return candidate as Candidate;
}

async function signedEvent(
  signer: NostrSigner,
  event: UnsignedEvent,
): Promise<SignedEvent> {
  const signed = await signer.signEvent(event);
  const fields = ['pubkey', 'created_at', 'kind', 'tags', 'content'] as const;
  if (
    !signed ||
    fields.some(
      field => JSON.stringify(signed[field]) !== JSON.stringify(event[field]),
    ) ||
    !/^[0-9a-f]{128}$/.test(signed.sig)
  )
    throw new Error('The signer returned a different event.');
  const serialised = JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);
  const id = await digest(new TextEncoder().encode(serialised));
  if (signed.id !== id)
    throw new Error('The signer returned an invalid event hash.');
  return signed;
}

function waitFor(
  socket: WebSocket,
  predicate: (message: unknown[]) => boolean,
  send: () => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        finish(
          new Error('Zapstore did not confirm the publication. Please retry.'),
        ),
      15000,
    );
    const message = ({ data }: MessageEvent<string>) => {
      try {
        const parsed: unknown = JSON.parse(data);
        if (Array.isArray(parsed) && predicate(parsed)) finish();
      } catch (error) {
        finish(error);
      }
    };
    const failed = () =>
      finish(new Error('The Zapstore relay connection failed. Please retry.'));
    function finish(error?: unknown) {
      clearTimeout(timer);
      socket.removeEventListener('message', message);
      socket.removeEventListener('error', failed);
      socket.removeEventListener('close', failed);
      if (error) reject(error);
      else resolve();
    }
    socket.addEventListener('message', message);
    socket.addEventListener('error', failed);
    socket.addEventListener('close', failed);
    try {
      send();
    } catch (error) {
      finish(error);
    }
  });
}

async function connect(Socket: typeof WebSocket): Promise<WebSocket> {
  const socket = new Socket(relayUrl);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('Could not connect to Zapstore.'));
    }, 15000);
    socket.onopen = () => {
      clearTimeout(timer);
      resolve();
    };
    socket.onerror = () => {
      clearTimeout(timer);
      socket.close();
      reject(new Error('Could not connect to Zapstore.'));
    };
  });
  return socket;
}

function publish(socket: WebSocket, event: SignedEvent): Promise<void> {
  return waitFor(
    socket,
    message => {
      if (message[0] !== 'OK' || message[1] !== event.id) return false;
      if (message[2] !== true)
        throw new Error(
          'Zapstore rejected the publication. Please retry or use zsp.',
        );
      return true;
    },
    () => socket.send(JSON.stringify(['EVENT', event])),
  );
}

export async function publishPreview(
  value: unknown,
  {
    signer,
    fetcher = fetch,
    Socket = WebSocket,
    status = () => {},
  }: PublishOptions = {},
): Promise<{ alreadyPublished: boolean }> {
  const candidate = validateCandidate(value);
  if (!signer?.getPublicKey || !signer?.signEvent)
    throw new Error(
      'Open this page in a browser with a NIP-07 Nostr signing extension.',
    );
  status('Confirm the Trustroots identity in your signing extension…');
  if ((await signer.getPublicKey()) !== publisher)
    throw new Error(
      'Select the Trustroots publisher identity in your signing extension.',
    );
  status('Checking the version already available in Zapstore…');
  const current = await zapstoreRelease(Socket);
  if (current.version === candidate.version) return { alreadyPublished: true };
  if (!/^0\.1-\d{8}-\d{4}$/.test(current.version))
    throw new Error(
      'Could not compare the current Zapstore version. Please use zsp.',
    );
  if (current.version > candidate.version)
    throw new Error(
      'Zapstore already has a newer preview. Wait for a new docs deployment.',
    );

  status('Verifying the prepared Android APK…');
  const response = await fetcher(`/assets/downloads/${candidate.sha256}.apk`, {
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(
      'The prepared APK is unavailable. Wait for a new docs deployment.',
    );
  const apk = await response.arrayBuffer();
  if (
    apk.byteLength !== candidate.size ||
    (await digest(apk)) !== candidate.sha256
  )
    throw new Error(
      'The prepared APK failed its hash check. Publication stopped.',
    );
  const now = () => Math.floor(Date.now() / 1000);
  const event = (
    kind: number,
    tags: string[][],
    content = '',
  ): UnsignedEvent => ({
    pubkey: publisher,
    created_at: now(),
    kind,
    tags,
    content,
  });
  const blobUrl = `${cdnUrl}/${candidate.sha256}`;
  const head = await fetcher(blobUrl, {
    method: 'HEAD',
    signal: AbortSignal.timeout(15000),
  });
  if (!head.ok) {
    if (head.status !== 404)
      throw new Error('Could not check the Zapstore APK upload. Please retry.');
    status('Approve the APK upload in your signing extension…');
    const auth = await signedEvent(
      signer,
      event(
        24242,
        [
          ['t', 'upload'],
          ['x', candidate.sha256],
          ['expiration', String(now() + 600)],
        ],
        `Upload ${candidate.sha256}`,
      ),
    );
    const upload = await fetcher(`${cdnUrl}/upload`, {
      method: 'PUT',
      headers: {
        Authorization: `Nostr ${btoa(JSON.stringify(auth))}`,
        'Content-Type': 'application/vnd.android.package-archive',
      },
      body: apk,
      signal: AbortSignal.timeout(60000),
    });
    if (!upload.ok) throw new Error('The APK upload failed. Please retry.');
    const uploaded: unknown = await upload.json();
    if (
      !uploaded ||
      typeof uploaded !== 'object' ||
      !('sha256' in uploaded) ||
      !('url' in uploaded) ||
      uploaded.sha256 !== candidate.sha256 ||
      uploaded.url !== blobUrl
    )
      throw new Error('Zapstore returned a different APK upload.');
  }
  const available = await fetcher(blobUrl, {
    method: 'HEAD',
    signal: AbortSignal.timeout(15000),
  });
  if (!available.ok)
    throw new Error('The uploaded APK is not yet available. Please retry.');

  const platforms = candidate.platforms.map(platform => ['f', platform]);
  status('Approve the Android release in your signing extension…');
  const asset = await signedEvent(
    signer,
    event(3063, [
      ['i', appId],
      ['x', candidate.sha256],
      ['version', candidate.version],
      ['url', blobUrl],
      ['m', 'application/vnd.android.package-archive'],
      ['size', String(candidate.size)],
      ...platforms,
      ['min_platform_version', String(candidate.minSdk)],
      ['target_platform_version', String(candidate.targetSdk)],
      ['filename', candidate.filename],
      ['version_code', String(candidate.versionCode)],
      ['apk_certificate_hash', certificate],
    ]),
  );
  const release = await signedEvent(
    signer,
    event(
      30063,
      [
        ['i', appId],
        ['version', candidate.version],
        ['d', `${appId}@${candidate.version}`],
        ['c', 'beta'],
        ...platforms,
        ['e', asset.id, relayUrl],
      ],
      `Signed Android preview ${candidate.version}. Build ${candidate.versionCode}.`,
    ),
  );
  status('Waiting for Zapstore to confirm the publication…');
  const socket = await connect(Socket);
  try {
    await publish(socket, asset);
    await publish(socket, release);
    await waitFor(
      socket,
      message =>
        message[0] === 'EVENT' &&
        message[1] === 'published-preview' &&
        matchesEvent(message[2], release),
      () =>
        socket.send(
          JSON.stringify(['REQ', 'published-preview', { ids: [release.id] }]),
        ),
    );
  } finally {
    socket.close();
  }
  return { alreadyPublished: false };
}

function matchesEvent(value: unknown, expected: SignedEvent): boolean {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<SignedEvent>;
  const fields = [
    'id',
    'sig',
    'pubkey',
    'created_at',
    'kind',
    'tags',
    'content',
  ] as const;
  return fields.every(
    field => JSON.stringify(event[field]) === JSON.stringify(expected[field]),
  );
}

export async function mountPublisher(
  document: Document,
  window: Window & { nostr?: NostrSigner },
): Promise<void> {
  const button = document.getElementById(
    'zapstore-publish',
  ) as HTMLButtonElement | null;
  const candidateText = document.getElementById('zapstore-candidate');
  const status = document.getElementById('zapstore-publish-status');
  if (!button || !candidateText || !status) return;
  let candidate: Candidate;
  try {
    const response = await fetch('/apps/zapstore-candidate.json', {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error(
        'No verified preview is prepared for browser publication yet.',
      );
    candidate = validateCandidate(await response.json());
    candidateText.textContent = `Version ${candidate.version} (build ${candidate.versionCode}). APK SHA-256: ${candidate.sha256}`;
    button.disabled = false;
    status.textContent =
      'Use the Trustroots Nostr signing identity to publish this signed APK.';
  } catch (error) {
    status.textContent = errorMessage(error);
    return;
  }
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const result = await publishPreview(candidate, {
        signer: window.nostr,
        status: text => {
          status.textContent = text;
        },
      });
      status.textContent = result.alreadyPublished
        ? `Version ${candidate.version} is already available in Zapstore.`
        : `Published version ${candidate.version} to Zapstore.`;
      const version = document.getElementById('android-zapstore-version');
      if (version) version.textContent = ` — version ${candidate.version}`;
    } catch (error) {
      status.textContent = errorMessage(error);
    } finally {
      button.disabled = false;
    }
  });
}
