import crypto from 'node:crypto';
import config from '../../support/app-config.mts';
import { withE2eDb } from '../../support/db.mts';
import { annotateFeature, test, expect } from '../../support/fixtures.mts';

test.use({ storageState: { cookies: [], origins: [] } });

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
    const key = crypto
      .createHmac('sha256', config.sessionSecret)
      .update(JSON.stringify([operation, dimension, identity, windowStart]))
      .digest('hex');
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
