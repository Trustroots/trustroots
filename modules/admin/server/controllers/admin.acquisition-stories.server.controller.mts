import mongoose, { type Types } from 'mongoose';
import crypto from 'node:crypto';
import mail from '../../../core/server/services/email.server.service.mts';
import { setEmailConfirmationToken } from '../../../users/server/services/email-confirmation.server.service.mts';
import authenticationService from '../../../users/server/services/authentication.server.service.mts';
import {
  getAdminIdentityIdentifiers,
  getUniqueAdminIdentityIdentifiers,
} from '../services/admin-identity.server.service.mts';

interface UserRecord {
  _id: Types.ObjectId;
  acquisitionStory?: string;
  created?: Date;
  displayName?: string;
  email: string;
  emailTemporary: string;
  emailToken?: string;
  emailTokenIssuedAt?: Date;
  emailTokenExpires?: Date;
  $locals?: { actionTokens?: Record<string, string> };
  languages?: string[];
  locationFrom?: string;
  locationLiving?: string;
  member: Array<{ tribe: Types.ObjectId }>;
  public?: boolean;
  roles: string[];
  username: string;
}

interface OfferRecord {
  location: number[];
  locationFuzzy: number[];
  updated: Date;
  user: Types.ObjectId;
  type?: string;
  status?: string;
}

interface MessageRecord {
  _id: Types.ObjectId;
  created: Date;
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
  shadowHidden?: boolean;
}

interface Welcomer {
  _id: Types.ObjectId;
  username: string;
  displayName?: string;
  created: Date;
}

interface WelcomeContact {
  _id: Types.ObjectId;
  welcomer: Welcomer;
}

interface RestrictedUser {
  user: UserRecord;
  identifiers: ReturnType<typeof getUniqueAdminIdentityIdentifiers>;
}

interface RestrictedMatch {
  _id: Types.ObjectId;
  displayName?: string;
  matchReasons: string[];
  restrictionStatuses: string[];
  username: string;
}

interface AcquisitionStory {
  _id: Types.ObjectId;
  acquisitionStory?: string;
  circleCount: number;
  created?: Date;
  displayName?: string;
  emailConfirmed: boolean;
  hostingLocation: number[] | null;
  locationFrom?: string;
  locationLiving?: string;
  languages: string[];
  welcomer: Welcomer | null;
  public: boolean;
  restrictionStatuses: string[];
  restrictedMatches: RestrictedMatch[];
  username: string;
}

interface SendResponse {
  send(body: unknown): unknown;
}

interface ResendResponse {
  status(code: number): ResendResponse;
  send(body: unknown): unknown;
  json(body: unknown): unknown;
}

interface ResendRequest {
  params?: { memberId?: unknown };
}

const Offer = mongoose.model<OfferRecord>('Offer');
const User = mongoose.model<UserRecord>('User');
const Message = mongoose.model<MessageRecord>('Message');

/** Get acquisition stories from users. */
function getStories(limit: number) {
  return User.find(
    {
      acquisitionStory: {
        $exists: true,
        $ne: '',
      },
    },
    // Stryker disable next-line StringLiteral: the projection only trims loaded fields; the response is built from named fields
    '_id acquisitionStory created displayName email emailTemporary languages locationFrom locationLiving member public roles username',
  )
    .sort('-created')
    .limit(limit)
    .exec();
}

const RESTRICTED_MATCH_LIMIT = 10;
const RESTRICTED_SOURCE_LIMIT = 1000;
const MIN_IDENTIFIER_LENGTH = 4;
const MATCH_BATCH_SIZE = 100;

function restrictionStatuses(user: UserRecord): string[] {
  return ['suspended', 'shadowban'].filter(status =>
    user.roles.includes(status),
  );
}

function getRestrictedIdentifiers(user: UserRecord) {
  return getUniqueAdminIdentityIdentifiers(user, MIN_IDENTIFIER_LENGTH);
}

async function getRestrictedMatches(
  story: UserRecord,
  restrictedUsers: RestrictedUser[],
): Promise<RestrictedMatch[]> {
  const preparedStory = {
    identifiers: getAdminIdentityIdentifiers(story).map(({ value }) => value),
  };
  const matches: RestrictedMatch[] = [];
  for (const [index, candidate] of restrictedUsers.entries()) {
    // Yield to I/O even when none of the candidates match. A result limit alone
    // does not bound the synchronous work for a list of 500 stories.
    // Stryker disable next-line ConditionalExpression,EqualityOperator: yielding more often only costs time; the matches are identical
    if (index % MATCH_BATCH_SIZE === 0) {
      await new Promise<void>(resolve => setImmediate(resolve));
    }
    const { user } = candidate;
    if (user._id.toString() === story._id.toString()) continue;
    const matchReasons = candidate.identifiers
      .filter(({ value }) =>
        preparedStory.identifiers.some(identifier =>
          identifier.includes(value),
        ),
      )
      .map(({ label }) => label);
    if (matchReasons.length) {
      matches.push({
        _id: user._id,
        displayName: user.displayName,
        matchReasons,
        restrictionStatuses: restrictionStatuses(user),
        username: user.username,
      });
      if (matches.length === RESTRICTED_MATCH_LIMIT) break;
    }
  }
  return matches;
}

function getRestrictedUsers() {
  return User.find({ roles: { $in: ['shadowban', 'suspended'] } })
    .select(
      // Stryker disable next-line StringLiteral: the projection only trims loaded fields; matches are built from named fields
      '_id displayName email emailTemporary roles username',
    )
    .sort({ created: -1, _id: 1 })
    .limit(RESTRICTED_SOURCE_LIMIT)
    .exec();
}

function storyForList(
  story: UserRecord,
  hostingLocation: number[] | null,
  restrictedMatches: RestrictedMatch[],
  welcomer: Welcomer | null,
): AcquisitionStory {
  return {
    _id: story._id,
    acquisitionStory: story.acquisitionStory,
    circleCount: story.member.length,
    created: story.created,
    displayName: story.displayName,
    emailConfirmed: Boolean(story.public || !story.emailTemporary),
    hostingLocation,
    locationFrom: story.locationFrom,
    locationLiving: story.locationLiving,
    languages: story.languages || [],
    welcomer,
    public: story.public === true,
    restrictionStatuses: restrictionStatuses(story),
    restrictedMatches,
    username: story.username,
  };
}

/** @esmNamed */
export const list = async (
  _req: unknown,
  res: SendResponse,
): Promise<unknown> => {
  const stories = await getStories(500);
  // Stryker disable next-line ConditionalExpression: an empty list also yields [] through the full path; this only skips the queries
  if (!stories || stories.length === 0) return res.send([]);

  const storyUserIds = stories.map(story => story._id);
  const currentWelcomerIds = (
    await User.find({ roles: 'welcome-team' })
      .select(
        // Stryker disable next-line StringLiteral: the projection only trims loaded fields; only _id is read
        '_id',
      )
      .exec()
  ).map(user => user._id);
  // Filter current team membership before selecting the first contact. Fetch
  // metadata for all recipients together, never loading message content.
  const welcomeContacts = await Message.aggregate<WelcomeContact>([
    {
      $match: {
        userTo: { $in: storyUserIds },
        userFrom: { $in: currentWelcomerIds },
        shadowHidden: { $ne: true },
        $expr: { $ne: ['$userFrom', '$userTo'] },
      },
    },
    {
      $lookup: {
        from: User.collection.name,
        localField: 'userFrom',
        foreignField: '_id',
        as: 'sender',
      },
    },
    { $unwind: '$sender' },
    { $match: { 'sender.roles': 'welcome-team' } },
    {
      $project: {
        userTo: 1,
        created: 1,
        'sender._id': 1,
        'sender.username': 1,
        'sender.displayName': 1,
      },
    },
    { $sort: { created: 1, _id: 1 } },
    {
      $group: {
        _id: '$userTo',
        welcomer: {
          $first: {
            _id: '$sender._id',
            username: '$sender.username',
            displayName: '$sender.displayName',
            created: '$created',
          },
        },
      },
    },
  ]).exec();
  const welcomersByUser = new Map(
    welcomeContacts.map(contact => [contact._id.toString(), contact.welcomer]),
  );
  const restrictedUsers: RestrictedUser[] = (await getRestrictedUsers()).map(
    user => ({
      user,
      identifiers: getRestrictedIdentifiers(user),
    }),
  );
  const hostingOffers =
    (await Offer.find({
      user: { $in: storyUserIds },
      type: 'host',
      status: { $in: ['yes', 'maybe'] },
    })
      .select(
        // Stryker disable next-line StringLiteral: the projection only trims loaded fields; only location, locationFuzzy and user are read
        'location locationFuzzy updated user',
      )
      .sort('-updated')
      .exec()) || [];
  const hostingLocationsByUser: Record<string, number[]> = hostingOffers.reduce(
    (locations, offer) => {
      const userId = offer.user.toString();
      if (!locations[userId]) {
        const location = offer.locationFuzzy.length
          ? offer.locationFuzzy
          : offer.location;
        locations[userId] = Array.from(location);
      }
      return locations;
    },
    {} as Record<string, number[]>,
  );
  const results: AcquisitionStory[] = [];
  for (const story of stories) {
    results.push(
      storyForList(
        story,
        hostingLocationsByUser[story._id.toString()] || null,
        await getRestrictedMatches(story, restrictedUsers),
        welcomersByUser.get(story._id.toString()) || null,
      ),
    );
  }
  return res.send(results);
};

/** @esmNamed */
/** Issue a fresh signup confirmation for an acquisition-story member. */
export const resendConfirmation = async (
  req: ResendRequest,
  res: ResendResponse,
): Promise<unknown> => {
  const userId = req.params?.memberId;
  if (typeof userId !== 'string' || !/^[a-f\d]{24}$/i.test(userId)) {
    return res.status(400).send({ message: 'Invalid account.' });
  }

  try {
    const id = new mongoose.Types.ObjectId(String(userId));
    const user = await User.findOne({
      _id: id,
      acquisitionStory: { $exists: true, $ne: '' },
      public: false,
      emailTemporary: { $type: 'string', $ne: '' },
    }).exec();
    if (!user) {
      return res.status(400).send({
        message: 'This account is no longer eligible for signup confirmation.',
      });
    }

    const previousToken = user.emailToken;
    const token = authenticationService.generateEmailToken(
      user,
      crypto.randomBytes(20),
    );
    setEmailConfirmationToken(user, token);
    const updated = await User.updateOne(
      {
        _id: id,
        acquisitionStory: { $exists: true, $ne: '' },
        public: false,
        emailTemporary: String(user.emailTemporary),
        emailToken: previousToken ? String(previousToken) : { $in: ['', null] },
      },
      {
        $set: {
          emailToken: user.emailToken,
          emailTokenIssuedAt: user.emailTokenIssuedAt,
          emailTokenExpires: user.emailTokenExpires,
        },
      },
    ).exec();
    if (updated.modifiedCount !== 1) {
      return res.status(400).send({
        message:
          'This account changed. Refresh the acquisition stories and try again.',
      });
    }

    await new Promise<void>((resolve, reject) =>
      mail.sendSignupEmailConfirmation(user, error =>
        error ? reject(error) : resolve(),
      ),
    );
    return res.json({
      message: 'Sent confirmation email.',
    });
  } catch {
    return res.status(500).send({
      message: 'Could not send the confirmation email. Please try again.',
    });
  }
};

const defaultInterop = { list, resendConfirmation };
export default defaultInterop;
/** @commonjs */
export { defaultInterop as 'module.exports' };
