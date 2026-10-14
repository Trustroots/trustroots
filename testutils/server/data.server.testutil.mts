import { faker } from '@faker-js/faker';
import mongoose, { type HydratedDocument, type Model } from 'mongoose';

import {
  generateExperiences,
  generateUsers,
  type ExperienceFixture,
  type GenerateUserOptions,
  type ServerUserFixture,
  type PushRegistrationFixture,
} from '../common/data.common.testutil.mts';

/** Error-first callback retained for legacy server tests. */
export type FixtureCallback<T> = (error: unknown | null, value?: T) => void;

interface UserFixtureMethods {
  authenticate(password: string): Promise<boolean>;
  hashPassword(password: string): Promise<string>;
}

interface UserFixtureStatics {
  hashPassword(password: string): Promise<string>;
}

interface UserFixtureExtraFields {
  additionalProvidersData?: {
    facebook?: { id?: string };
    github?: { login?: string };
    twitter?: { screen_name?: string };
  };
  blocked?: mongoose.Types.ObjectId[];
  avatarSource?: string;
  avatarUploaded?: boolean;
  avatarVersion?: string;
  created?: Date;
  emailHash?: string;
  emailTokenIssuedAt?: Date;
  emailTokenExpires?: Date;
  extSitesCouchers?: string;
  extSitesBW?: string;
  extSitesCS?: string;
  extSitesWS?: string;
  lastIpAddress?: string;
  providerData?: Record<string, unknown> | Array<Record<string, unknown>>;
  removeProfileToken?: string;
  removeProfileExpires?: Date | number;
  seen?: Date;
  provider?: string;
  emailTemporary?: string;
  publicReminderCount?: number;
  pushRegistration?: PushRegistrationFixture[];
  description?: string;
  displayName?: string;
  nostrNpub?: string;
  member?: Array<{ tribe: mongoose.Types.ObjectId; since?: Date }>;
}

type UserFixtureData = Omit<ServerUserFixture, 'roles' | 'languages'> &
  Partial<Pick<ServerUserFixture, 'roles' | 'languages'>> &
  UserFixtureExtraFields;
type CachedUserFixtureData = ServerUserFixture &
  UserFixtureExtraFields & { salt?: string };
type ExperienceFixtureDocument = HydratedDocument<ExperienceFixture> &
  Pick<ExperienceFixture, 'interactions'> & {
    _id: mongoose.Types.ObjectId;
  };
export type UserFixtureDocument = HydratedDocument<
  CachedUserFixtureData,
  UserFixtureMethods
>;
type UserFixtureModel = Model<
  CachedUserFixtureData,
  Record<string, never>,
  UserFixtureMethods
> &
  UserFixtureStatics;

interface SupertestResponse {
  send(body: unknown): SupertestResponse;
  set(name: string, value: string): SupertestResponse;
  expect(status: number): PromiseLike<unknown>;
}

interface SupertestAgent {
  post(path: string): SupertestResponse;
}

// Only the opt-in fixture helper uses this process-local cache.
const fixturePasswordHashes = new Map<string, string>();

/** Save typed fixture records and preserve the schema's normal save hooks. */
async function saveDocumentsToCollection<TFixture>(
  collection: string,
  documents: TFixture[],
): Promise<Array<HydratedDocument<TFixture>>> {
  const Model = mongoose.model<TFixture>(collection);
  const savedDocuments = documents.map(document => new Model(document));

  for (const document of savedDocuments) {
    await document.save();
  }

  return savedDocuments;
}

async function saveCachedUserDocuments(
  documents: UserFixtureData[],
): Promise<UserFixtureDocument[]> {
  const User = mongoose.model<CachedUserFixtureData, UserFixtureModel>('User');
  const savedDocuments = documents.map(document => new User(document));

  for (const document of savedDocuments) {
    const password = document.password;
    if (typeof password === 'string' && password.length >= 8) {
      // Validate plaintext before substituting a hash. Keep all other save hooks,
      // including display-name and email-hash generation, running normally.
      await document.validate();
      let hash = fixturePasswordHashes.get(password);
      if (hash === undefined) {
        hash = await User.hashPassword(password);
        fixturePasswordHashes.set(password, hash);
      }
      document.password = hash;
      document.salt = undefined;
      document.unmarkModified('password');
    }
    await document.save();
  }

  return savedDocuments;
}

/**
 * Save users to the database, optionally invoking the legacy callback as well
 * as returning the saved documents.
 */
async function saveUserFixtures(
  documents: UserFixtureData[],
  callback: FixtureCallback<UserFixtureDocument[]> = () => {},
  reusePasswords = false,
): Promise<UserFixtureDocument[]> {
  try {
    const savedDocuments = reusePasswords
      ? await saveCachedUserDocuments(documents)
      : await saveUserDocuments(documents);
    callback(null, savedDocuments);
    return savedDocuments;
  } catch (error: unknown) {
    callback(error);
    throw error;
  }
}

async function saveUserDocuments(
  documents: UserFixtureData[],
): Promise<UserFixtureDocument[]> {
  const User = mongoose.model<CachedUserFixtureData, UserFixtureModel>('User');
  const savedDocuments = documents.map(document => new User(document));

  for (const document of savedDocuments) {
    await document.save();
  }

  return savedDocuments;
}

export function saveUsers(
  documents: UserFixtureData[],
  callback: FixtureCallback<UserFixtureDocument[]> = () => {},
): Promise<UserFixtureDocument[]> {
  return saveUserFixtures(documents, callback, false);
}

/** Generate unrelated user fixtures with repeatable plaintext credentials. */
export function generateUsersWithSharedPassword(
  count: number,
  options: GenerateUserOptions = {},
): Array<ServerUserFixture & { password: string }> {
  return generateUsers(count, options).map(user => ({
    ...user,
    password: 'SharedFixturePassword123!',
  }));
}

/** Save unrelated fixtures with cached password hashes for authenticated tests. */
export function saveUsersWithCachedPasswords(
  documents: UserFixtureData[],
  callback: FixtureCallback<UserFixtureDocument[]> = () => {},
): Promise<UserFixtureDocument[]> {
  return saveUserFixtures(documents, callback, true);
}

/** Fields commonly overridden by direct model fixtures in server tests. */
export type TestUserOverrides = Partial<UserFixtureData> &
  Record<string, unknown>;

export function createTestUser(): UserFixtureDocument;
export function createTestUser(
  overrides: TestUserOverrides,
): UserFixtureDocument;
export function createTestUser(
  overrides: TestUserOverrides = {},
): UserFixtureDocument {
  const User = mongoose.model<CachedUserFixtureData, UserFixtureModel>('User');
  const user: TestUserOverrides & {
    firstName: string;
    lastName: string;
    displayName: string;
    username: string;
    email: string;
    password: string;
    provider: string;
    public: boolean;
    roles: string[];
  } = {
    firstName: 'Full',
    lastName: 'Name',
    displayName: 'Full Name',
    username: faker.internet.username(),
    email: faker.internet.email(),
    password: 'Password123!',
    provider: 'local',
    public: true,
    roles: ['user'],
    ...overrides,
  };

  // Drop keys overridden with `undefined` so schema defaults apply.
  for (const key of Object.keys(user)) {
    if (user[key] === undefined) {
      delete user[key];
    }
  }

  return new User(user);
}

/** Save experiences to the database, preserving the legacy callback. */
export async function saveExperiences(
  documents: ExperienceFixture[],
  callback: FixtureCallback<ExperienceFixtureDocument[]> = () => {},
): Promise<ExperienceFixtureDocument[]> {
  try {
    const savedDocuments = await saveDocumentsToCollection(
      'Experience',
      documents,
    );
    const experiences = savedDocuments as ExperienceFixtureDocument[];
    callback(null, experiences);
    return experiences;
  } catch (error: unknown) {
    callback(error);
    throw error;
  }
}

/** Clear all collections in a database. Usage in mocha: afterEach(clearDatabase). */
export async function clearDatabase(): Promise<void> {
  const models = mongoose
    .modelNames()
    .map(collection => mongoose.model<Record<string, unknown>>(collection));

  for (const Model of models) {
    await Model.deleteMany().exec();
  }
}

/** Sign in to the app using a Supertest agent. */
export async function signIn(
  user: { username: string; password: string },
  agent: SupertestAgent,
): Promise<void> {
  const { username, password } = user;
  await agent.post('/api/auth/signin').send({ username, password }).expect(200);
}

/** Sign out from the app using a Supertest agent. */
export async function signOut(agent: SupertestAgent): Promise<void> {
  await agent
    .post('/api/auth/signout')
    .set('X-Trustroots-Request', '1')
    .expect(302);
}

export { generateUsers, generateExperiences };
