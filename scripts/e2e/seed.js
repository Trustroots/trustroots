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
    username: 'e2e-seeded-berlin',
    email: 'e2e-seeded-berlin@example.test',
    firstName: 'Berlin',
    lastName: 'Host',
    location: [52.48556355813466, 13.489011526107788],
    tribes: ['Hitchhikers', 'Cyclists'],
  },
  {
    username: 'e2e-seeded-portland',
    email: 'e2e-seeded-portland@example.test',
    firstName: 'Portland',
    lastName: 'Host',
    location: [40.514402, -88.990735],
    tribes: ['Musicians', 'Artists'],
  },
  {
    username: 'e2e-seeded-beijing',
    email: 'e2e-seeded-beijing@example.test',
    firstName: 'Beijing',
    lastName: 'Host',
    location: [34.632532, 103.767519],
    tribes: ['Remote workers', 'Hikers'],
  },
  {
    username: 'e2e-seeded-shadow',
    email: 'e2e-seeded-shadow@example.test',
    firstName: 'Shadow',
    lastName: 'Spammer',
    roles: ['user', 'shadowban'],
    tribes: [],
  },
  {
    username: 'e2e-seeded-admin',
    email: 'e2e-seeded-admin@example.test',
    firstName: 'E2E',
    lastName: 'Admin',
    roles: ['user', 'admin'],
    tribes: [],
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
];

function buildUser(member) {
  return {
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

async function seedConversation(Message, Thread, usersByUsername, conversation) {
  let latestMessage;

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

async function seedAdminNotes(AdminNote, usersByUsername) {
  const note = new AdminNote({
    admin: usersByUsername['e2e-seeded-admin']._id,
    user: usersByUsername['e2e-seeded-shadow']._id,
    note: '<p><b>Performed action:</b></p><p><i>User shadowbanned.</i></p>',
  });
  await note.save();
}

async function seedDatabase() {
  const Tribe = mongoose.model('Tribe');
  const User = mongoose.model('User');
  const Offer = mongoose.model('Offer');
  const Message = mongoose.model('Message');
  const Thread = mongoose.model('Thread');
  const Experience = mongoose.model('Experience');
  const AdminNote = mongoose.model('AdminNote');

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
    await seedConversation(Message, Thread, usersByUsername, conversation);
  }

  await seedShadowMessages(Message, usersByUsername, SHADOW_MESSAGES);
  await seedExperiences(Experience, usersByUsername, EXPERIENCES);
  await seedAdminNotes(AdminNote, usersByUsername);
  await mongooseService.ensureIndexes(['User']);

  console.log(
    `Seeded ${TRIBES.length} tribes, ${MEMBERS.length} members, ` +
      `${CONVERSATIONS.length} conversations, ${SHADOW_MESSAGES.length} shadow-hidden messages, ` +
      `${EXPERIENCES.length} experiences, and admin notes for e2e tests.`,
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
