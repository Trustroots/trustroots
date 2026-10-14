import type {
  MiniProfile,
  OwnProfile,
  PublicProfile,
  UpdateProfileRequest,
} from '../../shared/profile.js';

const update: UpdateProfileRequest = {
  description: 'A fictional profile.',
  languages: ['en'],
  email: 'member@example.test',
};
void update;

const own: OwnProfile = {
  _id: 'fictional-id',
  username: 'fictional-member',
  displayName: 'Fictional Member',
  email: 'member@example.test',
  updated: '2026-01-01T00:00:00.000Z',
};
void own;

const publicProfile: PublicProfile = {
  _id: 'fictional-id',
  username: 'fictional-member',
  displayName: 'Fictional Member',
  additionalProvidersData: { facebook: { id: 'fictional-provider-id' } },
};
void publicProfile;

const mini: MiniProfile = {
  _id: 'fictional-id',
  username: 'fictional-member',
};
void mini;

const invalidRequest: UpdateProfileRequest = {
  // @ts-expect-error Email confirmation state is response-only.
  emailTemporary: 'pending@example.test',
};
void invalidRequest;

const invalidBootstrapRequest: UpdateProfileRequest = {
  // @ts-expect-error Bootstrap subscription state is not accepted by PUT /api/users.
  subscriptions: { news: true },
};
void invalidBootstrapRequest;

const invalidPublicProfile: PublicProfile = {
  _id: 'fictional-id',
  username: 'fictional-member',
  displayName: 'Fictional Member',
  // @ts-expect-error Public profiles must not expose the account email.
  email: 'member@example.test',
};
void invalidPublicProfile;

const invalidPublicAccessField: PublicProfile = {
  _id: 'fictional-id',
  username: 'fictional-member',
  displayName: 'Fictional Member',
  // @ts-expect-error The public profile endpoint strips this access-control field.
  public: true,
};
void invalidPublicAccessField;

const invalidMiniProfile: MiniProfile = {
  _id: 'fictional-id',
  username: 'fictional-member',
  // @ts-expect-error Mini profiles intentionally omit full descriptions.
  description: 'Too much information',
};
void invalidMiniProfile;
