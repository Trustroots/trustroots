const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const {
  findDiscoveryHostingLocations,
}: typeof import('../../../../users/server/services/discovery-hosting.server.service.mts') = require('../../../../users/server/services/discovery-hosting.server.service.mts');

describe('Discovery hosting locations', () => {
  it('avoids a query when there are no eligible owners', async () => {
    const find = sinon.spy(mongoose.model('Offer'), 'find');
    try {
      assert.deepEqual(
        await findDiscoveryHostingLocations([], [], new Date()),
        new Map(),
      );
      assert.equal(find.callCount, 0);
    } finally {
      find.restore();
    }
  });

  it('queries current host offers and retains the newest valid approximate location per owner', async () => {
    const first = new mongoose.Types.ObjectId();
    const second = new mongoose.Types.ObjectId();
    const now = new Date();
    const find = sinon.spy(mongoose.model('Offer'), 'find');
    const exec = sinon.stub(mongoose.Query.prototype, 'exec').resolves([
      { user: first, locationFuzzy: [91, 10] },
      { user: first, locationFuzzy: [5, -181] },
      { user: first, locationFuzzy: [-90, 180] },
      { user: first, locationFuzzy: [4, 5] },
      { user: second, locationFuzzy: [2, 3] },
    ]);
    try {
      assert.deepEqual(
        await findDiscoveryHostingLocations([first, second], [first], now),
        new Map([
          [first.toString(), [-90, 180]],
          [second.toString(), [2, 3]],
        ]),
      );
      assert.deepEqual(find.firstCall.args[0], {
        user: { $in: [first, second] },
        type: 'host',
        status: { $in: ['yes', 'maybe'] },
        locationFuzzy: { $size: 2 },
        $and: [
          {
            $or: [
              { validUntil: { $gte: now } },
              { validUntil: { $exists: false } },
            ],
          },
          {
            $or: [
              { showOnlyInMyCircles: { $ne: true } },
              { user: { $in: [first] } },
            ],
          },
        ],
      });
      const query = find.firstCall.returnValue;
      assert.deepEqual(query.projection(), { user: 1, locationFuzzy: 1 });
      assert.deepEqual(query.getOptions().sort, { updated: -1, _id: 1 });
    } finally {
      find.restore();
      exec.restore();
    }
  });
});
