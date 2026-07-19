const mongoose = require('mongoose');
const should = require('should');
const sinon = require('sinon');

const cleanup = require('../../../server/services/historical-spam-cleanup.server.service');

const AdminNote = mongoose.model('AdminNote');
const Contact = mongoose.model('Contact');
const Experience = mongoose.model('Experience');
const Message = mongoose.model('Message');
const Offer = mongoose.model('Offer');
const ReferenceThread = mongoose.model('ReferenceThread');
const Thread = mongoose.model('Thread');
const User = mongoose.model('User');

const campaignDate = new Date('2021-07-04T12:00:00.000Z');
let createdUserIds;
let sequence;

async function createCandidate(overrides = {}) {
  sequence += 1;
  const user = new User({
    created: campaignDate,
    email: `historical-spam-${sequence}@example.test`,
    emailTemporary: `historical-spam-${sequence}@example.test`,
    firstName: 'Historical',
    lastName: `Spam ${sequence}`,
    password: 'correct horse battery staple',
    provider: 'local',
    public: false,
    roles: ['user', 'suspended'],
    username: `historical_spam_${sequence}`,
    ...overrides,
  });
  await user.save();
  createdUserIds.push(user._id);
  return user;
}

async function removeCreatedData() {
  const userQuery = { $in: createdUserIds };
  await Promise.all([
    AdminNote.deleteMany({ user: userQuery }),
    Contact.deleteMany({
      $or: [{ userFrom: userQuery }, { userTo: userQuery }],
    }),
    Experience.deleteMany({
      $or: [{ userFrom: userQuery }, { userTo: userQuery }],
    }),
    Message.deleteMany({
      $or: [{ userFrom: userQuery }, { userTo: userQuery }],
    }),
    Offer.deleteMany({ user: userQuery }),
    ReferenceThread.deleteMany({
      $or: [{ userFrom: userQuery }, { userTo: userQuery }],
    }),
    Thread.deleteMany({
      $or: [{ userFrom: userQuery }, { userTo: userQuery }],
    }),
    User.deleteMany({ _id: userQuery }),
  ]);
}

describe('Service: historical spam cleanup', () => {
  beforeEach(() => {
    createdUserIds = [];
    sequence = 0;
  });

  afterEach(async () => {
    sinon.restore();
    await removeCreatedData();
  });

  it('uses safe defaults when there are no campaign accounts', async () => {
    const result = await cleanup.run();

    result.should.deepEqual({
      candidates: 0,
      eligible: 0,
      protected: 0,
      deleted: 0,
    });
  });

  it('retains an account protected immediately before deletion', async () => {
    const candidate = await createCandidate();
    const query = result => ({
      select() {
        return this;
      },
      lean() {
        return Promise.resolve(result);
      },
    });
    const find = sinon.stub(AdminNote, 'find');
    find.onFirstCall().returns(query([]));
    find.onSecondCall().returns(query([{ user: candidate._id }]));

    const result = await cleanup.run({ deleteAccounts: true });

    result.should.deepEqual({
      candidates: 1,
      eligible: 0,
      protected: 1,
      deleted: 0,
    });
    should.exist(await User.findById(candidate._id));
  });

  it('supports legacy and empty deletion results', async () => {
    await createCandidate();
    const deleteMany = sinon.stub(User, 'deleteMany');
    deleteMany.onFirstCall().resolves({ n: 1 });
    deleteMany.onSecondCall().resolves({});

    const legacyResult = await cleanup.run({ deleteAccounts: true });
    const emptyResult = await cleanup.run({ deleteAccounts: true });
    deleteMany.restore();

    legacyResult.deleted.should.equal(1);
    emptyResult.deleted.should.equal(0);
  });

  it('dry-runs eligible campaign accounts and retains protected accounts', async () => {
    const eligible = await createCandidate();
    const manualSuspension = await createCandidate();
    const messageSender = await createCandidate();
    const messageRecipient = await createCandidate();
    const threadSender = await createCandidate();
    const threadRecipient = await createCandidate();
    const contactSender = await createCandidate();
    const contactRecipient = await createCandidate();
    const offerOwner = await createCandidate();
    const experienceSender = await createCandidate();
    const experienceRecipient = await createCandidate();
    const referenceSender = await createCandidate();
    const referenceRecipient = await createCandidate();
    const member = await createCandidate({
      member: [{ tribe: new mongoose.Types.ObjectId() }],
    });
    const blocker = await createCandidate({
      blocked: [new mongoose.Types.ObjectId()],
    });
    const pushUser = await createCandidate({
      pushRegistration: [
        {
          platform: 'web',
          token: `push-token-${sequence}`,
          created: campaignDate,
        },
      ],
    });
    const avatarUser = await createCandidate({ avatarUploaded: true });
    const outsideCampaign = await createCandidate({
      created: new Date('2022-01-01T00:00:00.000Z'),
    });
    const otherUserId = new mongoose.Types.ObjectId();

    await Promise.all([
      new AdminNote({
        user: manualSuspension._id,
        note: 'Manual suspension',
      }).save(),
      new Message({
        content: 'Message from candidate',
        userFrom: messageSender._id,
        userTo: otherUserId,
      }).save(),
      new Message({
        content: 'Message to candidate',
        userFrom: otherUserId,
        userTo: messageRecipient._id,
      }).save(),
      new Thread({ userFrom: threadSender._id, userTo: otherUserId }).save(),
      new Thread({ userFrom: otherUserId, userTo: threadRecipient._id }).save(),
      new Contact({ userFrom: contactSender._id, userTo: otherUserId }).save(),
      new Contact({
        userFrom: otherUserId,
        userTo: contactRecipient._id,
      }).save(),
      new Offer({ location: [60, 24], user: offerOwner._id }).save(),
      new Experience({
        userFrom: experienceSender._id,
        userTo: otherUserId,
      }).save(),
      new Experience({
        userFrom: otherUserId,
        userTo: experienceRecipient._id,
      }).save(),
      new ReferenceThread({
        thread: new mongoose.Types.ObjectId(),
        userFrom: referenceSender._id,
        userTo: otherUserId,
        reference: 'yes',
      }).save(),
      new ReferenceThread({
        thread: new mongoose.Types.ObjectId(),
        userFrom: otherUserId,
        userTo: referenceRecipient._id,
        reference: 'yes',
      }).save(),
    ]);

    const batches = [];
    const dryRun = await cleanup.run({
      batchSize: 2,
      onBatch: batch => batches.push(batch),
    });

    dryRun.should.containEql({
      candidates: 13,
      eligible: 1,
      protected: 12,
      deleted: 0,
    });
    batches.should.have.length(7);
    should.exist(await User.findById(eligible._id));
    should.exist(await User.findById(manualSuspension._id));
    should.exist(await User.findById(member._id));
    should.exist(await User.findById(blocker._id));
    should.exist(await User.findById(pushUser._id));
    should.exist(await User.findById(avatarUser._id));
    should.exist(await User.findById(outsideCampaign._id));

    const deletion = await cleanup.run({ deleteAccounts: true, batchSize: 2 });

    deletion.should.containEql({
      candidates: 13,
      eligible: 1,
      protected: 12,
      deleted: 1,
    });
    should.not.exist(await User.findById(eligible._id));
    should.exist(await User.findById(manualSuspension._id));
  });
});
