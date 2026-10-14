/**
 * Shared, anonymous client/server fixture generators used by tests.
 */

import { ObjectId } from 'mongodb';
import { faker } from '@faker-js/faker';
import lodash from 'lodash';
import type { PublicProviderIdentities } from '../../modules/users/shared/profile.ts';

const { defaultsDeep, range, sample, sampleSize } = lodash;

export type FixtureId = string | ObjectId;

/** The common identity fields shared by generated server and client users. */
export interface UserFixture {
  _id?: FixtureId;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  languages: string[];
}

/** The user-shaped fields produced for database fixtures. */
export interface ServerUserFixture extends UserFixture {
  locale?: string;
  public?: boolean;
  roles: string[];
  password: string;
  additionalProvidersData?: PublicProviderIdentities;
  extSitesCouchers?: string;
  extSitesBW?: string;
  extSitesCS?: string;
  extSitesWS?: string;
  newsletter?: boolean;
  pushRegistration?: PushRegistrationFixture[];
}

/** The user-shaped fields produced for client component and API fixtures. */
export interface ClientUserFixture extends UserFixture {
  _id: string;
  displayName: string;
  memberIds?: string[];
  public?: boolean;
  gender?: string;
  tagline?: string;
  description?: string;
  locationFrom?: string;
  locationLiving?: string;
  member?: unknown[];
  replyRate?: string;
  replyTime?: string;
  avatarSource?: string;
  avatarUploaded?: boolean;
  avatarVersion?: string;
  nostrNpub?: string;
  blocked?: string[];
  provider?: string;
  locale?: string;
}

/** Push-registration fixture properties used by test data and model defaults. */
export interface PushRegistrationFixture {
  platform?: string;
  token?: string;
  [property: string]: unknown;
}

/** Optional fields accepted when generating user fixture arrays. */
export interface GenerateUserOptions {
  additionalProvidersData?: PublicProviderIdentities;
  email?: string;
  extSitesCouchers?: string;
  extSitesBW?: string;
  extSitesCS?: string;
  extSitesWS?: string;
  locale?: string;
  newsletter?: boolean;
  public?: boolean;
  pushRegistration?: PushRegistrationFixture[];
  username?: string;
}

/** Optional fields callers may override on one generated client fixture. */
export interface GenerateClientUserOptions extends Partial<
  Omit<ClientUserFixture, '_id' | 'displayName'>
> {
  _id?: string;
  displayName?: string;
  roles?: string[];
  emailTemporary?: string;
  emailHash?: string;
  created?: string;
  updated?: string;
}

/** Fixture representation of a circle used to assign random client members. */
export interface TribeFixture {
  _id: string;
  label: string;
  labelHistory: string;
  slugHistory: string;
  synonyms: string;
  color: string;
  count: number;
  created: number;
  modified: number;
  public: boolean;
  image: boolean;
  attribution: string;
  attribution_url: string;
  description: string;
}

/** Possible recommendation values generated for experience fixtures. */
export type ExperienceRecommendation = 'yes' | 'no' | 'unknown';

/** Generated experience relationship flags. */
export interface ExperienceInteractionsFixture {
  met: boolean;
  guest: boolean;
  host: boolean;
}

/** The generated fields shared by experience fixture records. */
export interface ExperienceFixture {
  userFrom: FixtureId | undefined;
  userTo: FixtureId | undefined;
  public: boolean;
  interactions: ExperienceInteractionsFixture;
  recommend: ExperienceRecommendation | undefined;
  [property: string]: unknown;
}

/** Fields that may override the generated experience defaults. */
export type GenerateExperienceOptions = Partial<
  Pick<ExperienceFixture, 'public' | 'interactions' | 'recommend'>
> & { [property: string]: unknown };

/** An indexed pair of users and optional values that override defaults. */
export type ExperienceDataEntry = readonly [
  userFromIndex: number,
  userToIndex: number,
  overrides?: GenerateExperienceOptions,
];

function generateValidUsername(): string {
  const suffix = faker.number.int({ min: 100, max: 9999 });
  const stem = faker.internet
    .username()
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
    .replace(/^[0-9]+/, '');
  const username = `${stem || 'member'}${suffix}`.slice(0, 34);
  return username.length >= 3 ? username : `member${suffix}`.slice(0, 34);
}

function generateBaseUser(): Omit<UserFixture, '_id'> {
  return {
    username: generateValidUsername(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email(),
    languages: [],
  };
}

function generateServerUser(overrides: GenerateUserOptions): ServerUserFixture {
  return {
    ...generateBaseUser(),
    locale: '',
    public: faker.datatype.boolean(),
    roles: ['user'],
    password: faker.internet.password(),
    ...overrides,
  };
}

export { generateValidUsername };

export function generateId(): string {
  return new ObjectId().toString();
}

export function generateClientUser(): ClientUserFixture;
export function generateClientUser<
  TOverrides extends GenerateClientUserOptions,
>(overrides: TOverrides): ClientUserFixture & TOverrides;
export function generateClientUser(
  overrides: GenerateClientUserOptions = {},
): ClientUserFixture {
  return {
    _id: generateId(),
    displayName: faker.person.fullName(),
    ...generateBaseUser(),
    ...overrides,
  };
}

function selectRandom<T>(list: readonly T[], fraction = 0.5): T[] {
  const count = Math.floor(list.length * fraction);
  return sampleSize(list, count);
}

export function generateUsers(
  count: number,
  options?: GenerateUserOptions,
  type?: 'server',
  tribes?: readonly TribeFixture[],
): ServerUserFixture[];
export function generateUsers(
  count: number,
  options: GenerateUserOptions | undefined,
  type: 'client',
  tribes?: readonly TribeFixture[],
): ClientUserFixture[];
export function generateUsers(
  count: number,
  options: GenerateUserOptions | undefined,
  type: 'server' | 'client',
  tribes?: readonly TribeFixture[],
): ServerUserFixture[] | ClientUserFixture[];
export function generateUsers(
  count: number,
  {
    additionalProvidersData,
    extSitesCouchers,
    extSitesBW,
    extSitesCS,
    extSitesWS,
    locale,
    newsletter,
    public: isPublic,
    pushRegistration,
  }: GenerateUserOptions = {},
  type: string = 'server',
  tribes: readonly TribeFixture[] = [],
): Array<ServerUserFixture | ClientUserFixture | undefined> {
  return range(count).map(() => {
    switch (type) {
      case 'server':
        return generateServerUser({
          additionalProvidersData,
          extSitesCouchers,
          extSitesBW,
          extSitesCS,
          extSitesWS,
          locale,
          newsletter,
          public: isPublic,
          pushRegistration,
        });
      case 'client':
        return generateClientUser({
          memberIds: selectRandom(tribes, 0.4).map(tribe => tribe._id),
        });
    }
  });
}

function generateTribe(index: number): TribeFixture {
  return {
    _id: generateId(),
    label: `${faker.lorem.word()}_${index}`,
    labelHistory: faker.lorem.words(),
    slugHistory: faker.lorem.words(),
    synonyms: faker.lorem.words(),
    color: faker.color.rgb({ format: 'hex', prefix: '' }),
    count: Math.floor(Math.random() * 50000),
    created: Date.now(),
    modified: Date.now(),
    public: true,
    image: false,
    attribution: faker.person.fullName(),
    attribution_url: faker.internet.url(),
    description: faker.lorem.sentences(),
  };
}

export function generateTribes(count: number): TribeFixture[] {
  return range(count).map(index => generateTribe(index));
}

export function generateExperiences(
  users: readonly Pick<UserFixture, '_id'>[],
  experienceData: readonly ExperienceDataEntry[],
): ExperienceFixture[] {
  return experienceData.map(([userFromIndex, userToIndex, overrides = {}]) => {
    const defaultExperience: ExperienceFixture = {
      userFrom: users[userFromIndex]._id,
      userTo: users[userToIndex]._id,
      public: true,
      interactions: {
        met: faker.datatype.boolean(),
        guest: faker.datatype.boolean(),
        host: faker.datatype.boolean(),
      },
      recommend: sample<ExperienceRecommendation>(['yes', 'no', 'unknown']),
    };

    return defaultsDeep({}, overrides, defaultExperience);
  });
}
