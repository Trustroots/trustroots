// Compile-only regressions; this module is never executed by the test runners.
import {
  generateClientUser,
  generateExperiences,
  generateUsers,
} from '../../../../testutils/common/data.common.testutil.mts';
import {
  createTestUser,
  signIn,
} from '../../../../testutils/server/data.server.testutil.mts';
import { SUPPORT_CATEGORIES } from '../../../support/shared/categories.ts';

// @ts-expect-error Support category keys are a closed set.
void SUPPORT_CATEGORIES.unknownCategory;

const users = generateUsers(2, { public: true, newsletter: false });
const username: string = users[0].username;
void username;

// @ts-expect-error Fixture visibility is a boolean.
generateUsers(1, { public: 'yes' });
// @ts-expect-error Fixture generation only supports the existing two variants.
generateUsers(1, {}, 'other');
// @ts-expect-error Client usernames retain their string contract.
generateClientUser({ username: 123 });

const participants = [generateClientUser(), generateClientUser()];
generateExperiences(participants, [[0, 1, { recommend: 'yes' }]]);
// @ts-expect-error Experience recommendations use the existing enum values.
generateExperiences(participants, [[0, 1, { recommend: 'maybe' }]]);

createTestUser({ public: false, roles: ['user'] });
// @ts-expect-error User visibility is a boolean in fixture overrides.
createTestUser({ public: 'yes' });
declare const agent: Parameters<typeof signIn>[1];
// @ts-expect-error Sign-in credentials require a plaintext password.
signIn({ username: 'fixture-member' }, agent);
