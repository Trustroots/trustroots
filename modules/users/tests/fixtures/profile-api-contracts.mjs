// @ts-check

/** @type {import('../../shared/profile.js').UpdateProfileRequest} */
const update = {
  description: 'A fictional profile.',
  languages: ['en'],
  email: 'member@example.test',
};
void update;

/** @type {import('../../shared/profile.js').OwnProfile} */
const own = {
  _id: 'fictional-id',
  username: 'fictional-member',
  displayName: 'Fictional Member',
  email: 'member@example.test',
  updated: '2026-01-01T00:00:00.000Z',
};
void own;

/** @type {import('../../shared/profile.js').PublicProfile} */
const publicProfile = {
  _id: 'fictional-id',
  username: 'fictional-member',
  displayName: 'Fictional Member',
  additionalProvidersData: { facebook: { id: 'fictional-provider-id' } },
};
void publicProfile;

/** @type {import('../../shared/profile.js').MiniProfile} */
const mini = {
  _id: 'fictional-id',
  username: 'fictional-member',
};
void mini;

/** @type {import('../../shared/profile.js').UpdateProfileRequest} */
const invalidRequest = {
  // @ts-expect-error Email confirmation state is response-only.
  emailTemporary: 'pending@example.test',
};
void invalidRequest;

/** @type {import('../../shared/profile.js').UpdateProfileRequest} */
const invalidBootstrapRequest = {
  // @ts-expect-error Bootstrap subscription state is not accepted by PUT /api/users.
  subscriptions: { news: true },
};
void invalidBootstrapRequest;

/** @type {import('../../shared/profile.js').PublicProfile} */
const invalidPublicProfile = {
  _id: 'fictional-id',
  username: 'fictional-member',
  displayName: 'Fictional Member',
  // @ts-expect-error Public profiles must not expose the account email.
  email: 'member@example.test',
};
void invalidPublicProfile;

/** @type {import('../../shared/profile.js').PublicProfile} */
const invalidPublicAccessField = {
  _id: 'fictional-id',
  username: 'fictional-member',
  displayName: 'Fictional Member',
  // @ts-expect-error The public profile endpoint strips this access-control field.
  public: true,
};
void invalidPublicAccessField;

/** @type {import('../../shared/profile.js').MiniProfile} */
const invalidMiniProfile = {
  _id: 'fictional-id',
  username: 'fictional-member',
  // @ts-expect-error Mini profiles intentionally omit full descriptions.
  description: 'Too much information',
};
void invalidMiniProfile;
