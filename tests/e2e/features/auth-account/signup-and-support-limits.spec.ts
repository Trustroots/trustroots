import crypto from 'node:crypto';
import config from '../../support/app-config.mts';
import { withE2eDb } from '../../support/db.mts';
import { annotateFeature, test, expect } from '../../support/fixtures.mts';
import { createUser, registerViaApi } from '../../support/helpers.mts';

test.use({ storageState: { cookies: [], origins: [] } });

function requestLimitKey(
  operation: string,
  dimension: string,
  identity: string,
  windowStart: number,
) {
  return crypto
    .createHmac('sha256', config.sessionSecret)
    .update(JSON.stringify([operation, dimension, identity, windowStart]))
    .digest('hex');
}

for (const operation of ['signup', 'support']) {
  test(`${operation} returns Retry-After without persisting a request beyond its allowance`, async ({
    request,
  }, testInfo) => {
    annotateFeature(
      testInfo,
      operation === 'signup' ? 'auth.signup' : 'public.support-submit',
      [
        'Requests beyond the configured allowance return Retry-After before persistence.',
      ],
    );
    const policy = config.targetedRequestLimits[operation];
    const suffix = crypto.randomBytes(8).toString('hex');
    const email = `allowance-${suffix}@example.test`;
    const clientIp = '203.0.113.87';
    const dimension = operation === 'signup' ? 'recipient' : 'ip';
    const identity = operation === 'signup' ? email : clientIp;
    const windowStart =
      Math.floor(Date.now() / policy.windowMs) * policy.windowMs;
    const key = requestLimitKey(operation, dimension, identity, windowStart);
    await withE2eDb(db =>
      db.collection('requestlimits').insertOne({
        key,
        count: operation === 'signup' ? policy.identityLimit : policy.ipLimit,
        expiresAt: new Date(windowStart + policy.windowMs),
      }),
    );
    try {
      const response = await request.post(
        operation === 'signup' ? '/api/auth/signup' : '/api/support',
        {
          headers: { '!~Passenger-Client-Address': clientIp },
          data:
            operation === 'signup'
              ? {
                  ageConfirmed: true,
                  firstName: 'Amina',
                  lastName: 'Vale',
                  username: `allowance-${suffix}`,
                  email,
                  password: 'fictional-password-123',
                }
              : { email, message: `A fictional allowance enquiry ${suffix}.` },
        },
      );
      expect(response.status()).toBe(429);
      expect(response.headers()['retry-after']).toMatch(/^\d+$/);
      const count = await withE2eDb(db =>
        db
          .collection(operation === 'signup' ? 'users' : 'supportrequests')
          .countDocuments({ email }),
      );
      expect(count).toBe(0);
    } finally {
      await withE2eDb(db => db.collection('requestlimits').deleteOne({ key }));
    }
  });
}

test('browser and mobile submissions share the member support allowance', async ({
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'public.support-submit', [
    'Browser and mobile submissions share the member support allowance.',
  ]);
  const member = createUser();
  const { _id } = await registerViaApi(request, member);
  const signin = await request.post('/api/mobile/v0/auth/signin', {
    headers: { Cookie: '' },
    data: { username: member.username, password: member.password },
  });
  expect(signin.status()).toBe(200);
  const { accessToken } = (await signin.json()) as { accessToken: string };

  const policy = config.targetedRequestLimits.support;
  const windowStart =
    Math.floor(Date.now() / policy.windowMs) * policy.windowMs;
  const key = requestLimitKey('support', 'member', _id, windowStart);
  await withE2eDb(db =>
    db.collection('requestlimits').insertOne({
      key,
      count: policy.identityLimit - 1,
      expiresAt: new Date(windowStart + policy.windowMs),
    }),
  );

  try {
    const browserSubmission = await request.post('/api/support', {
      headers: { '!~Passenger-Client-Address': '203.0.113.88' },
      data: { message: 'A fictional browser support enquiry.' },
    });
    expect(browserSubmission.status()).toBe(200);

    const mobileSubmission = await request.post('/api/mobile/v0/support', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Cookie: '',
        '!~Passenger-Client-Address': '203.0.113.89',
      },
      data: { message: 'A fictional mobile support enquiry.' },
    });
    expect(mobileSubmission.status()).toBe(429);
    expect(mobileSubmission.headers()['retry-after']).toMatch(/^\d+$/);
    expect(mobileSubmission.headers()['cache-control']).toContain('no-store');
    const count = await withE2eDb(db =>
      db.collection('supportrequests').countDocuments({ email: member.email }),
    );
    expect(count).toBe(1);
  } finally {
    await withE2eDb(db => db.collection('requestlimits').deleteOne({ key }));
  }
});
