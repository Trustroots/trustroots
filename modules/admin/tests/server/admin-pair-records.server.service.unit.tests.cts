const mongoose: typeof import('mongoose') = require('mongoose');
const should: typeof import('should') = require('should');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
const {
  findPairRecords,
}: typeof import('../../server/services/admin-pair-records.server.service.mts') = require('../../server/services/admin-pair-records.server.service.mts');

type MessageRecord =
  import('../../../../testutils/server/model-contracts.mts').MessageRecord;
type PopulatedUser = {
  _id: import('mongoose').Types.ObjectId;
  username?: string;
  displayName?: string;
  email?: string;
};
type PopulatedMessage = {
  content: string;
  userFrom: PopulatedUser;
  userTo: PopulatedUser;
};

const Message = mongoose.model<MessageRecord>('Message');

describe('Admin pair records service', () => {
  afterEach(utils.clearDatabase);

  it('finds both directions in creation order with both users populated', async () => {
    const [first, second, other] = await utils.saveUsersWithCachedPasswords(
      utils.generateUsersWithSharedPassword(3),
    );
    // Insert in reverse creation order, so only the sort orders them.
    await Message.create({
      content: 'later',
      created: new Date('2026-06-01T10:02:00.000Z'),
      userFrom: second._id,
      userTo: first._id,
    });
    await Message.create({
      content: 'earlier',
      created: new Date('2026-06-01T10:01:00.000Z'),
      userFrom: first._id,
      userTo: second._id,
    });
    await Message.create({
      content: 'unrelated',
      created: new Date('2026-06-01T10:00:00.000Z'),
      userFrom: first._id,
      userTo: other._id,
    });

    const records = (await findPairRecords(
      Message as unknown as Parameters<typeof findPairRecords>[0],
      first._id,
      second._id,
    ).exec()) as unknown as PopulatedMessage[];

    records
      .map(record => record.content)
      .should.deepEqual(['earlier', 'later']);
    const [earlier, later] = records;
    should(earlier.userFrom.username).equal(first.username);
    should(earlier.userFrom.displayName).equal(first.displayName);
    should(earlier.userTo.username).equal(second.username);
    should(earlier.userTo.displayName).equal(second.displayName);
    should(later.userFrom.username).equal(second.username);
    should(later.userTo.username).equal(first.username);
    // Only the public name fields are loaded.
    should(earlier.userFrom.email).be.undefined();
    should(earlier.userTo.email).be.undefined();
  });
});
