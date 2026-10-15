/**
 * Seed the end-to-end test database with a small, deterministic dataset.
 * Invoked by scripts/e2e/test-e2e.sh after the database is dropped.
 */
import mongoose, {
  type Model,
  type HydratedDocument,
  type Types,
} from 'mongoose';
import mongooseService from './../../config/lib/mongoose.mjs';
import {
  CONVERSATIONS,
  E2E_PASSWORD,
  MEMBERS,
  SHADOW_MESSAGES,
} from './data.mts';

import './../../modules/offers/server/models/offer.server.model.mjs';
interface SeedMember {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  emailTemporary?: string;
  locationFrom?: unknown;
  locationLiving?: unknown;
  roles?: string[];
  acquisitionStory?: string;
  tribes?: string[];
  location?: number[];
}
interface SeedUser {
  _id: Types.ObjectId;
  username: string;
  member: { tribe: Types.ObjectId; since: Date }[];
}
interface SeedTribe {
  _id: Types.ObjectId;
  label: string;
  count: number;
}
interface SeedMessage {
  _id: Types.ObjectId;
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
  created: Date;
  read: boolean;
  content: string;
}
interface SeedThread {
  _id: Types.ObjectId;
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
}
type UsersByUsername = Record<string, HydratedDocument<SeedUser>>;
type TribesByLabel = Record<string, HydratedDocument<SeedTribe>>;
type SeedRecord = Record<string, unknown>;

const PROFILE_DESCRIPTION =
  'Seeded member profile for end-to-end tests. I enjoy hosting travellers, sharing local tips, and meeting people from around the world through the Trustroots hospitality network.';

const TRIBES = [
  {
    label: 'Hitchhikers',
    color: 'e74c3c',
    description: 'For people who travel by thumb.',
  },
  {
    label: 'Cyclists',
    color: '3498db',
    description: 'Bike tourers and commuters.',
  },
  {
    label: 'Vegans',
    color: '2ecc71',
    description: 'Plant-based travellers and hosts.',
  },
  {
    label: 'Families',
    color: 'f39c12',
    description: 'Travelling with children.',
  },
  {
    label: 'Musicians',
    color: '9b59b6',
    description: 'People who travel with instruments.',
  },
  {
    label: 'Artists',
    color: '1abc9c',
    description: 'Creatives on the road.',
  },
  {
    label: 'Remote workers',
    color: '34495e',
    description: 'Digital nomads and remote workers.',
  },
  {
    label: 'Sailors',
    color: '2980b9',
    description: 'People who travel by boat.',
  },
  {
    label: 'Climbers',
    color: 'd35400',
    description: 'Rock climbers and mountaineers.',
  },
  {
    label: 'Hikers',
    color: '27ae60',
    description: 'Long-distance walkers and trekkers.',
  },
  {
    label: 'Naturists',
    color: '8e6e53',
    description: 'A member-only circle for naturist travellers and hosts.',
  },
];

const EXPERIENCES = [
  {
    from: 'e2e-seeded-berlin',
    to: 'e2e-seeded-portland',
    public: true,
    recommend: 'yes',
    interactions: { met: true, guest: true, host: false },
    feedbackPublic:
      'E2E seeded experience: Portland was a welcoming host on my trip.',
  },
  {
    from: 'e2e-seeded-alice',
    to: 'e2e-seeded-bob',
    public: false,
    recommend: 'unknown',
    interactions: { met: true, guest: false, host: false },
    feedbackPublic: 'E2E seeded private experience for coverage.',
  },
  {
    from: 'e2e-seeded-portland',
    to: 'e2e-seeded-berlin',
    public: true,
    recommend: 'no',
    interactions: { met: true, guest: false, host: true },
    feedbackPublic: 'E2E seeded negative experience for admin coverage.',
  },
];

const CONTACTS = [
  {
    from: 'e2e-seeded-portland',
    to: 'e2e-seeded-alice',
    confirmed: true,
  },
  {
    from: 'e2e-seeded-bob',
    to: 'e2e-seeded-alice',
    confirmed: false,
  },
];

const BLOCKS = [
  {
    blocker: 'e2e-seeded-alice',
    blocked: 'e2e-seeded-bob',
  },
];

const MEET_OFFERS = [
  {
    user: 'e2e-seeded-alice',
    description: '<p>E2E seeded active meet offer</p>',
    location: [51.5, -0.1],
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  },
  {
    user: 'e2e-seeded-bob',
    description: '<p>E2E seeded expired meet offer</p>',
    location: [48.8566, 2.3522],
    validUntil: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
];

function buildUser(member: SeedMember) {
  return {
    _id: member.id,
    username: member.username,
    email: member.email,
    emailTemporary: member.emailTemporary,
    firstName: member.firstName,
    lastName: member.lastName,
    displayName: `${member.firstName} ${member.lastName}`,
    password: E2E_PASSWORD,
    provider: 'local',
    public: true,
    welcomeSequenceStep: 3,
    description: PROFILE_DESCRIPTION,
    locationFrom: member.locationFrom,
    locationLiving: member.locationLiving,
    member: [],
    roles: member.roles || ['user'],
    acquisitionStory: member.acquisitionStory,
  };
}

async function seedTribes(Tribe: Model<SeedTribe>) {
  const tribesByLabel: TribesByLabel = {};
  const tribeCounts: Record<string, number> = {};

  for (const tribeData of TRIBES) {
    const tribe = new Tribe({
      ...tribeData,
      public: true,
      count: 0,
    });
    await tribe.save();
    tribesByLabel[tribe.label] = tribe;
    tribeCounts[tribe.label] = 0;
  }

  return { tribesByLabel, tribeCounts };
}

async function seedUsers(
  User: Model<SeedUser>,
  Offer: Model<SeedRecord>,
  members: SeedMember[],
  tribesByLabel: TribesByLabel,
  tribeCounts: Record<string, number>,
) {
  const usersByUsername: UsersByUsername = {};

  for (const member of members) {
    let user = new User(buildUser(member));

    for (const tribeLabel of member.tribes || []) {
      const tribe = tribesByLabel[tribeLabel];
      user.member.push({
        tribe: tribe._id,
        since: new Date(),
      });
      tribeCounts[tribeLabel] += 1;
    }

    // These fixtures represent members whose punctuation predates selection policy.
    const legacyUsername = user.username;
    user.username = legacyUsername.replace(/[^a-z0-9]/gi, '');
    await user.save();
    await User.collection.updateOne(
      { _id: user._id },
      { $set: { username: legacyUsername } },
    );
    user = (await User.findById(user._id))!;
    usersByUsername[member.username] = user;

    if (member.location) {
      const offer = new Offer({
        type: 'host',
        status: 'yes',
        description: '<p>E2E seeded host offer</p>',
        maxGuests: 2,
        user: user._id,
        location: member.location,
        showOnlyInMyCircles: false,
      });
      await offer.save();
    }
  }

  return usersByUsername;
}

async function updateTribeCounts(
  Tribe: Model<SeedTribe>,
  tribesByLabel: TribesByLabel,
  tribeCounts: Record<string, number>,
) {
  for (const [label, count] of Object.entries(tribeCounts)) {
    if (count > 0) {
      await Tribe.updateOne({ _id: tribesByLabel[label]._id }, { count });
    }
  }
}

async function seedConversation(
  Message: Model<SeedMessage>,
  MessageStat: Model<SeedRecord>,
  Thread: Model<SeedThread>,
  usersByUsername: UsersByUsername,
  conversation: (typeof CONVERSATIONS)[number],
) {
  let latestMessage: HydratedDocument<SeedMessage> | undefined;
  const messages: HydratedDocument<SeedMessage>[] = [];

  for (const entry of conversation.messages) {
    const message = new Message({
      userFrom: usersByUsername[entry.from]._id,
      userTo: usersByUsername[entry.to]._id,
      content: entry.content,
      read: entry.read ?? true,
      shadowHidden: false,
      notificationCount: 0,
    });
    await message.save();
    messages.push(message);
    latestMessage = message;
  }

  const thread = new Thread({
    updated: latestMessage!.created,
    userFrom: latestMessage!.userFrom,
    userTo: latestMessage!.userTo,
    message: latestMessage!._id,
    read: latestMessage!.read,
  });
  await thread.save();

  const firstMessage = messages[0];
  const firstReply = messages
    .slice(1)
    .find(
      message =>
        message.userFrom.equals(firstMessage.userTo) &&
        message.userTo.equals(firstMessage.userFrom),
    );
  const messageStat = new MessageStat({
    firstMessageUserFrom: firstMessage.userFrom,
    firstMessageUserTo: firstMessage.userTo,
    firstMessageCreated: firstMessage.created,
    firstMessageLength: firstMessage.content.length,
    firstReplyCreated: firstReply?.created ?? null,
    firstReplyLength: firstReply?.content.length ?? null,
    timeToFirstReply: firstReply
      ? firstReply.created.getTime() - firstMessage.created.getTime()
      : null,
  });
  await messageStat.save();
}

async function seedShadowMessages(
  Message: Model<SeedMessage>,
  usersByUsername: UsersByUsername,
  shadowMessages: typeof SHADOW_MESSAGES,
) {
  for (const entry of shadowMessages) {
    const message = new Message({
      userFrom: usersByUsername[entry.from]._id,
      userTo: usersByUsername[entry.to]._id,
      content: entry.content,
      read: true,
      shadowHidden: true,
      notificationCount: 0,
    });
    await message.save();
  }
}

async function seedReferenceThreads(
  ReferenceThread: Model<SeedRecord>,
  Thread: Model<SeedThread>,
  usersByUsername: UsersByUsername,
) {
  const thread = await Thread.findOne({
    $or: [
      {
        userFrom: usersByUsername['e2e-seeded-berlin']._id,
        userTo: usersByUsername['e2e-seeded-portland']._id,
      },
      {
        userFrom: usersByUsername['e2e-seeded-portland']._id,
        userTo: usersByUsername['e2e-seeded-berlin']._id,
      },
    ],
  });

  if (!thread) {
    return;
  }

  const referenceThread = new ReferenceThread({
    thread: thread._id,
    userFrom: usersByUsername['e2e-seeded-berlin']._id,
    userTo: usersByUsername['e2e-seeded-portland']._id,
    reference: 'no',
  });
  await referenceThread.save();
}

async function seedExperiences(
  Experience: Model<SeedRecord>,
  usersByUsername: UsersByUsername,
  experiences: typeof EXPERIENCES,
) {
  for (const entry of experiences) {
    const experience = new Experience({
      userFrom: usersByUsername[entry.from]._id,
      userTo: usersByUsername[entry.to]._id,
      public: entry.public,
      recommend: entry.recommend,
      interactions: entry.interactions,
      feedbackPublic: entry.feedbackPublic,
    });
    await experience.save();
  }
}

async function seedContacts(
  Contact: Model<SeedRecord>,
  usersByUsername: UsersByUsername,
  contacts: typeof CONTACTS,
) {
  for (const entry of contacts) {
    const contact = new Contact({
      userFrom: usersByUsername[entry.from]._id,
      userTo: usersByUsername[entry.to]._id,
      confirmed: entry.confirmed,
    });
    await contact.save();
  }
}

async function seedBlockedRelationships(
  User: Model<SeedUser>,
  usersByUsername: UsersByUsername,
  blocks: typeof BLOCKS,
) {
  for (const entry of blocks) {
    await User.updateOne(
      { _id: usersByUsername[entry.blocker]._id },
      { $addToSet: { blocked: usersByUsername[entry.blocked]._id } },
    );
  }
}

async function seedMeetOffers(
  Offer: Model<SeedRecord>,
  usersByUsername: UsersByUsername,
  meetOffers: typeof MEET_OFFERS,
) {
  for (const entry of meetOffers) {
    const offer = new Offer({
      type: 'meet',
      status: 'yes',
      description: entry.description,
      validUntil: entry.validUntil,
      user: usersByUsername[entry.user]._id,
      location: entry.location,
      showOnlyInMyCircles: false,
    });
    await offer.save();
  }
}

async function seedAdminNotes(
  AdminNote: Model<SeedRecord>,
  usersByUsername: UsersByUsername,
) {
  const note = new AdminNote({
    admin: usersByUsername['e2e-seeded-admin']._id,
    user: usersByUsername['e2e-seeded-shadow']._id,
    note: '<p><b>Performed action:</b></p><p><i>User shadowbanned.</i></p>',
  });
  await note.save();
}

async function seedAuditLogs(
  AuditLog: Model<SeedRecord>,
  usersByUsername: UsersByUsername,
) {
  const auditLog = new AuditLog({
    body: { action: 'e2e seeded audit log' },
    ip: '127.0.0.1',
    params: {},
    query: {},
    route: '/api/admin/e2e-seeded',
    user: usersByUsername['e2e-seeded-admin']._id,
  });
  await auditLog.save();
}

async function seedDatabase() {
  const Tribe = mongoose.model<SeedTribe>('Tribe');
  const User = mongoose.model<SeedUser>('User');
  const Offer = mongoose.model<SeedRecord>('Offer');
  const Message = mongoose.model<SeedMessage>('Message');
  const MessageStat = mongoose.model<SeedRecord>('MessageStat');
  const Thread = mongoose.model<SeedThread>('Thread');
  const Experience = mongoose.model<SeedRecord>('Experience');
  const Contact = mongoose.model<SeedRecord>('Contact');
  const ReferenceThread = mongoose.model<SeedRecord>('ReferenceThread');
  const AdminNote = mongoose.model<SeedRecord>('AdminNote');
  const AuditLog = mongoose.model<SeedRecord>('AuditLog');

  const { tribesByLabel, tribeCounts } = await seedTribes(Tribe);
  const usersByUsername = await seedUsers(
    User,
    Offer,
    MEMBERS,
    tribesByLabel,
    tribeCounts,
  );
  await updateTribeCounts(Tribe, tribesByLabel, tribeCounts);

  for (const conversation of CONVERSATIONS) {
    await seedConversation(
      Message,
      MessageStat,
      Thread,
      usersByUsername,
      conversation,
    );
  }

  await seedShadowMessages(Message, usersByUsername, SHADOW_MESSAGES);
  await seedReferenceThreads(ReferenceThread, Thread, usersByUsername);
  await seedExperiences(Experience, usersByUsername, EXPERIENCES);
  await seedContacts(Contact, usersByUsername, CONTACTS);
  await seedBlockedRelationships(User, usersByUsername, BLOCKS);
  await seedMeetOffers(Offer, usersByUsername, MEET_OFFERS);
  await seedAdminNotes(AdminNote, usersByUsername);
  await seedAuditLogs(AuditLog, usersByUsername);
  await mongooseService.ensureIndexes(mongoose.modelNames());

  console.log(
    `Seeded ${TRIBES.length} tribes, ${MEMBERS.length} members, ` +
      `${CONVERSATIONS.length} conversations, ${SHADOW_MESSAGES.length} shadow-hidden messages, ` +
      `${EXPERIENCES.length} experiences, ${CONTACTS.length} contacts, ` +
      `${BLOCKS.length} blocked relationships, ${MEET_OFFERS.length} meet offers, ` +
      `reference threads, admin notes, and audit logs for e2e tests.`,
  );
}

function run() {
  return new Promise<void>((resolve, reject) => {
    mongooseService.connect(() => {
      mongooseService.loadModels(async () => {
        try {
          await seedDatabase();
          mongooseService.disconnect();
          resolve();
        } catch (error) {
          mongooseService.disconnect();
          reject(error);
        }
      });
    });
  });
}

run()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('E2E seed failed:', error);
    process.exit(1);
  });
