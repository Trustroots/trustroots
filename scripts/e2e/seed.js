/**
 * Seed the end-to-end test database with a small, deterministic dataset.
 * Invoked by scripts/e2e/test-e2e.sh after the database is dropped.
 */
const mongoose = require('mongoose');
const mongooseService = require('../../config/lib/mongoose');

require('../../modules/offers/server/models/offer.server.model');

const E2E_PASSWORD = 'Tester123';
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
];

const MEMBERS = [
  {
    id: '665000000000000000000001',
    username: 'e2e-seeded-berlin',
    email: 'e2e-seeded-berlin@example.test',
    firstName: 'Berlin',
    lastName: 'Host',
    location: [52.48556355813466, 13.489011526107788],
    tribes: ['Hitchhikers', 'Cyclists'],
  },
  {
    id: '665000000000000000000002',
    username: 'e2e-seeded-portland',
    email: 'e2e-seeded-portland@example.test',
    firstName: 'Portland',
    lastName: 'Host',
    location: [40.514402, -88.990735],
    tribes: ['Musicians', 'Artists'],
  },
  {
    id: '665000000000000000000003',
    username: 'e2e-seeded-beijing',
    email: 'e2e-seeded-beijing@example.test',
    firstName: 'Beijing',
    lastName: 'Host',
    location: [34.632532, 103.767519],
    tribes: ['Remote workers', 'Hikers'],
  },
  {
    id: '665000000000000000000004',
    username: 'e2e-seeded-shadow',
    email: 'e2e-seeded-shadow@example.test',
    firstName: 'Shadow',
    lastName: 'Spammer',
    roles: ['user', 'shadowban'],
    tribes: [],
  },
  {
    id: '665000000000000000000005',
    username: 'e2e-seeded-admin',
    email: 'e2e-seeded-admin@example.test',
    firstName: 'E2E',
    lastName: 'Admin',
    roles: ['user', 'admin'],
    tribes: [],
  },
  {
    id: '665000000000000000000006',
    username: 'e2e-seeded-alice',
    email: 'e2e-seeded-alice@example.test',
    firstName: 'Alice',
    lastName: 'Contact',
    acquisitionStory: 'I found Trustroots through hitchhiking friends online.',
    tribes: ['Families'],
  },
  {
    id: '665000000000000000000007',
    username: 'e2e-seeded-bob',
    email: 'e2e-seeded-bob@example.test',
    firstName: 'Bob',
    lastName: 'Blocked',
    tribes: ['Climbers'],
  },
];

const CONVERSATIONS = [
  {
    key: 'berlin-portland',
    messages: [
      {
        from: 'e2e-seeded-portland',
        to: 'e2e-seeded-berlin',
        content: 'Hi Berlin host, are you available next week?',
        read: true,
      },
      {
        from: 'e2e-seeded-berlin',
        to: 'e2e-seeded-portland',
        content: 'Yes, happy to host you!',
        read: false,
      },
    ],
  },
];

const SHADOW_MESSAGES = [
  {
    from: 'e2e-seeded-shadow',
    to: 'e2e-seeded-berlin',
    content: 'Hidden outreach from shadowbanned member',
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

function buildUser(member) {
  return {
    _id: member.id,
    username: member.username,
    email: member.email,
    firstName: member.firstName,
    lastName: member.lastName,
    displayName: `${member.firstName} ${member.lastName}`,
    password: E2E_PASSWORD,
    provider: 'local',
    public: true,
    welcomeSequenceStep: 3,
    description: PROFILE_DESCRIPTION,
    member: [],
    roles: member.roles || ['user'],
    acquisitionStory: member.acquisitionStory,
  };
}

async function seedTribes(Tribe) {
  const tribesByLabel = {};
  const tribeCounts = {};

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

async function seedUsers(User, Offer, members, tribesByLabel, tribeCounts) {
  const usersByUsername = {};

  for (const member of members) {
    const user = new User(buildUser(member));

    for (const tribeLabel of member.tribes || []) {
      const tribe = tribesByLabel[tribeLabel];
      user.member.push({
        tribe: tribe._id,
        since: new Date(),
      });
      tribeCounts[tribeLabel] += 1;
    }

    await user.save();
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

async function updateTribeCounts(Tribe, tribesByLabel, tribeCounts) {
  for (const [label, count] of Object.entries(tribeCounts)) {
    if (count > 0) {
      await Tribe.updateOne({ _id: tribesByLabel[label]._id }, { count });
    }
  }
}

async function seedConversation(
  Message,
  MessageStat,
  Thread,
  usersByUsername,
  conversation,
) {
  let latestMessage;
  const messages = [];

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
    updated: latestMessage.created,
    userFrom: latestMessage.userFrom,
    userTo: latestMessage.userTo,
    message: latestMessage._id,
    read: latestMessage.read,
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

async function seedShadowMessages(Message, usersByUsername, shadowMessages) {
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

async function seedReferenceThreads(ReferenceThread, Thread, usersByUsername) {
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

async function seedExperiences(Experience, usersByUsername, experiences) {
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

async function seedContacts(Contact, usersByUsername, contacts) {
  for (const entry of contacts) {
    const contact = new Contact({
      userFrom: usersByUsername[entry.from]._id,
      userTo: usersByUsername[entry.to]._id,
      confirmed: entry.confirmed,
    });
    await contact.save();
  }
}

async function seedBlockedRelationships(User, usersByUsername, blocks) {
  for (const entry of blocks) {
    await User.updateOne(
      { _id: usersByUsername[entry.blocker]._id },
      { $addToSet: { blocked: usersByUsername[entry.blocked]._id } },
    );
  }
}

async function seedMeetOffers(Offer, usersByUsername, meetOffers) {
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

async function seedAdminNotes(AdminNote, usersByUsername) {
  const note = new AdminNote({
    admin: usersByUsername['e2e-seeded-admin']._id,
    user: usersByUsername['e2e-seeded-shadow']._id,
    note: '<p><b>Performed action:</b></p><p><i>User shadowbanned.</i></p>',
  });
  await note.save();
}

async function seedAuditLogs(AuditLog, usersByUsername) {
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
  const Tribe = mongoose.model('Tribe');
  const User = mongoose.model('User');
  const Offer = mongoose.model('Offer');
  const Message = mongoose.model('Message');
  const MessageStat = mongoose.model('MessageStat');
  const Thread = mongoose.model('Thread');
  const Experience = mongoose.model('Experience');
  const Contact = mongoose.model('Contact');
  const ReferenceThread = mongoose.model('ReferenceThread');
  const AdminNote = mongoose.model('AdminNote');
  const AuditLog = mongoose.model('AuditLog');

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
  return new Promise((resolve, reject) => {
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
