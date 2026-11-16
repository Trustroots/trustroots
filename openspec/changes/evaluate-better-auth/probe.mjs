/* eslint-disable import/no-unresolved -- Probe dependencies are installed in an isolated directory. */
/* global navigator, PublicKeyCredential */
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { chromium } from '@playwright/test';
import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { toNodeHandler } from 'better-auth/node';
import { twoFactor } from 'better-auth/plugins';

function authenticatorCode(uri) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const secret = new URL(uri).searchParams.get('secret');
  assert.ok(secret);
  const bits = [...secret.replace(/=+$/, '')]
    .map(char => alphabet.indexOf(char).toString(2).padStart(5, '0'))
    .join('');
  const key = Buffer.from(
    [...bits.matchAll(/[01]{8}/g)].map(([byte]) => parseInt(byte, 2)),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac('sha1', key).update(counter).digest();
  const offset = digest.at(-1) & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(
    6,
    '0',
  );
}

const server = createServer();
server.listen(0, 'localhost');
await once(server, 'listening');
let browser;
try {
  const origin = 'http://localhost:' + server.address().port;
  const auth = betterAuth({
    baseURL: origin,
    secret: randomBytes(32).toString('hex'),
    database: memoryAdapter({
      user: [],
      account: [],
      session: [],
      verification: [],
      passkey: [],
      twoFactor: [],
    }),
    emailAndPassword: { enabled: true },
    plugins: [
      passkey({
        rpID: 'localhost',
        origin,
        authenticatorSelection: { userVerification: 'required' },
      }),
      twoFactor(),
    ],
  });
  const handler = toNodeHandler(auth);
  server.on('request', (request, response) => {
    if (request.url?.startsWith('/api/auth/'))
      return handler(request, response);
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end('<!doctype html><title>Better Auth evaluation</title>');
  });

  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(origin);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });

  async function api(path, body) {
    const response =
      body === undefined
        ? await page.request.get(origin + '/api/auth/' + path)
        : await page.request.post(origin + '/api/auth/' + path, {
            data: body,
            headers: { Origin: origin },
          });
    assert.ok(response.ok(), path + ' returned HTTP ' + response.status());
    return response.json();
  }

  const credentials = {
    email: 'member@example.test',
    password: randomBytes(24).toString('hex'),
  };
  const { user } = await api('sign-up/email', {
    name: 'Test Member',
    ...credentials,
  });
  await api('sign-out', {});
  await api('sign-in/email', credentials);
  assert.equal((await api('get-session')).user.id, user.id);
  process.stdout.write(
    'Password sign-in established a session for the existing account.\n',
  );

  const registration = await api('passkey/generate-register-options');
  const registered = await page.evaluate(
    async options =>
      (
        await navigator.credentials.create({
          publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(options),
        })
      ).toJSON(),
    registration,
  );
  await api('passkey/verify-registration', {
    response: registered,
    name: 'Evaluation passkey',
  });
  const { totpURI } = await api('two-factor/enable', {
    password: credentials.password,
  });
  await api('two-factor/verify-totp', { code: authenticatorCode(totpURI) });
  await api('sign-out', {});

  const options = await api('passkey/generate-authenticate-options');
  const assertion = await page.evaluate(
    async options =>
      (
        await navigator.credentials.get({
          publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(options),
        })
      ).toJSON(),
    options,
  );
  await api('passkey/verify-authentication', { response: assertion });
  const passkeySession = await api('get-session');
  assert.equal(passkeySession.user.id, user.id);
  assert.equal(passkeySession.user.twoFactorEnabled, true);
  process.stdout.write(
    'Passkey-first sign-in established a session for the same account under the default 2FA policy.\n',
  );
  await api('sign-out', {});

  assert.equal(
    (await api('sign-in/email', credentials)).twoFactorRedirect,
    true,
  );
  assert.equal(await api('get-session'), null);
  await api('two-factor/verify-totp', { code: authenticatorCode(totpURI) });
  assert.equal((await api('get-session')).user.id, user.id);
  process.stdout.write(
    'Password sign-in granted a session only after TOTP verification.\n',
  );
  const savedCookie = await browser.newContext({
    storageState: await page.context().storageState(),
  });
  const readSavedSession = () =>
    savedCookie.request.get(origin + '/api/auth/get-session');
  assert.equal((await (await readSavedSession()).json()).user.id, user.id);
  await api('revoke-sessions', {});
  assert.equal(await (await readSavedSession()).json(), null);
  process.stdout.write(
    'Revoking sessions invalidated the existing browser cookie.\n',
  );
} finally {
  try {
    await browser?.close();
  } finally {
    await new Promise((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve())),
    );
  }
}
