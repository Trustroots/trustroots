import {
  MongoClient,
  ObjectId,
  type Db,
  type DeleteResult,
  type Filter,
  type UpdateResult,
} from 'mongodb';

export interface UserDocument {
  [key: string]: unknown;
  _id: ObjectId;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  displayName?: string;
  emailTemporary?: string;
  roles?: string[];
  public?: boolean;
  description?: string;
  tagline?: string;
  usernameUpdated?: Date;
  emailToken?: string;
  emailTokenIssuedAt?: Date;
  emailTokenExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  removeProfileToken?: string;
  removeProfileExpires?: Date;
  authVersion?: number;
  avatarUploaded?: boolean;
  avatarVersion?: number;
  additionalProvidersData?: Record<string, unknown>;
  pushRegistration?: Array<{
    platform: 'android' | 'ios' | 'web' | 'expo';
    token?: string;
    created?: Date;
    deviceId?: string;
  }>;
  locationLiving?: string;
  locationFrom?: string;
  birthdate?: Date;
  gender?: string;
  languages?: string[];
  nostrNpub?: string;
  extSitesCouchers?: string;
  extSitesBW?: string;
  extSitesCS?: string;
  extSitesWS?: string;
  updated?: Date;
  created?: Date;
  acquisitionStory?: string;
  member: Array<{
    since?: Date;
    tribe?: ObjectId;
  }>;
  blocked?: ObjectId[];
  publicReminderCount?: number;
  publicReminderSent?: Date;
  welcomeSequenceSent?: Date;
  welcomeSequenceStep?: number;
}

export interface ContactDocument {
  [key: string]: unknown;
  userFrom: ObjectId;
  userTo: ObjectId;
  confirmed: boolean;
  created: Date;
}

export interface OfferDocument {
  [key: string]: unknown;
  _id: ObjectId;
  user: ObjectId;
  type: 'host' | 'meet';
  status: 'yes' | 'maybe' | 'no';
  description: string;
  noOfferDescription?: string;
  maxGuests: number;
  location: number[];
  locationFuzzy?: number[];
  updated?: Date;
  createdAt?: Date;
  validUntil?: Date;
  showOnlyInMyCircles?: boolean;
}

interface ExperienceDocument {
  [key: string]: unknown;
  userFrom: ObjectId;
  userTo: ObjectId;
}

interface AgendaJobDocument {
  [key: string]: unknown;
  name: string;
  data: {
    to: { address: string };
    text?: string;
  };
}

export type UserTestUpdate = {
  $set?: Partial<UserDocument> & Record<string, unknown>;
  $unset?: Record<string, '' | 1 | true>;
  $addToSet?: { roles?: string | { $each: string[] } };
  $pull?: { roles?: string };
};

type ActionTokenField =
  'emailToken' | 'resetPasswordToken' | 'removeProfileToken';

const mongoHost = process.env.DB_1_PORT_27017_TCP_ADDR || '127.0.0.1';
const mongoUri =
  process.env.TRUSTROOTS_E2E_MONGO_URI ||
  `mongodb://${mongoHost}:27017/trustroots-test`;

export async function withE2eDb<T>(
  callback: (db: Db) => Promise<T> | T,
): Promise<T> {
  const client = await MongoClient.connect(mongoUri);

  try {
    return await callback(client.db());
  } finally {
    await client.close();
  }
}

export function objectId(id: string | ObjectId): ObjectId {
  return typeof id === 'string' ? new ObjectId(id) : id;
}

export async function findUserByUsername(
  username: string,
): Promise<UserDocument | null> {
  return withE2eDb(db =>
    db.collection<UserDocument>('users').findOne({ username }),
  );
}

export async function findContactByUsers(
  userFrom: string | ObjectId,
  userTo: string | ObjectId,
): Promise<ContactDocument | null> {
  return withE2eDb(db =>
    db.collection<ContactDocument>('contacts').findOne({
      $or: [
        { userFrom: objectId(userFrom), userTo: objectId(userTo) },
        { userFrom: objectId(userTo), userTo: objectId(userFrom) },
      ],
    }),
  );
}

export async function findOffersByUser(
  userId: string | ObjectId,
  query: Filter<OfferDocument> = {},
): Promise<OfferDocument[]> {
  return withE2eDb(db =>
    db
      .collection<OfferDocument>('offers')
      .find({ user: objectId(userId), ...query })
      .sort({ updated: -1, createdAt: -1 })
      .toArray(),
  );
}

export async function updateUserByUsername(
  username: string,
  update: UserTestUpdate,
): Promise<UpdateResult> {
  return withE2eDb(db =>
    db.collection('users').updateOne({ username }, update),
  );
}

export async function removeUserByUsername(
  username: string,
): Promise<DeleteResult> {
  return withE2eDb(db =>
    db.collection<UserDocument>('users').deleteOne({ username }),
  );
}

export async function removeExperiencesBetweenUsernames(
  usernameFrom: string,
  usernameTo: string,
): Promise<DeleteResult | { deletedCount: 0 }> {
  return withE2eDb(async db => {
    const users = db.collection<UserDocument>('users');
    const [userFrom, userTo] = await Promise.all([
      users.findOne({ username: usernameFrom }),
      users.findOne({ username: usernameTo }),
    ]);

    if (!userFrom?._id || !userTo?._id) {
      return { deletedCount: 0 };
    }

    return db.collection<ExperienceDocument>('experiences').deleteMany({
      $or: [
        { userFrom: userFrom._id, userTo: userTo._id },
        { userFrom: userTo._id, userTo: userFrom._id },
      ],
    });
  });
}

export async function findActionToken(
  username: string,
  field: ActionTokenField,
): Promise<string> {
  const paths: Record<ActionTokenField, string> = {
    emailToken: 'confirm-email',
    resetPasswordToken: 'api/auth/reset',
    removeProfileToken: 'remove',
  };
  return withE2eDb(async db => {
    const user = await db
      .collection<UserDocument>('users')
      .findOne({ username });
    if (!user) {
      throw new Error('No account action email found for test member.');
    }
    const jobs = await db
      .collection<AgendaJobDocument>('agendaJobs')
      .find({
        name: 'send email',
        'data.to.address': user.emailTemporary || user.email,
      })
      .sort({ _id: -1 })
      .toArray();
    const pattern = new RegExp('/' + paths[field] + '/([a-f0-9]+)');
    for (const job of jobs) {
      const match = job.data.text?.match(pattern);
      if (match) return match[1];
    }
    throw new Error('No account action email found for test member.');
  });
}
