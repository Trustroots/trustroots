import mongoose from 'mongoose';
import sinon from 'sinon';
import assert from 'node:assert/strict';
import { findDiscoveryOfferLocations } from '../../../../users/server/services/discovery-offers.server.service.mts';

describe('Discovery hosting locations', () => {
  it('avoids a query when there are no eligible owners', async () => {
    const find = sinon.spy(mongoose.model('Offer'), 'find');
    try {
      assert.deepEqual(
        await findDiscoveryOfferLocations([], [], new Date()),
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
      { user: first, status: 'yes', locationFuzzy: [91, 10] },
      { user: first, status: 'yes', locationFuzzy: [5, -181] },
      { user: first, status: 'yes', locationFuzzy: [-90, 180] },
      { user: first, status: 'yes', locationFuzzy: [4, 5] },
      { user: second, status: 'maybe', locationFuzzy: [2, 3] },
    ]);
    try {
      assert.deepEqual(
        await findDiscoveryOfferLocations([first, second], [first], now),
        new Map([
          [first.toString(), { type: 'host', location: [-90, 180] }],
          [second.toString(), { type: 'host', location: [2, 3] }],
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
      assert.deepEqual(query.projection(), {
        user: 1,
        locationFuzzy: 1,
        status: 1,
      });
      assert.deepEqual(query.getOptions().sort, { updated: -1, _id: 1 });
    } finally {
      find.restore();
      exec.restore();
    }
  });

  it('retains the newest meeting location when an owner has no hosting offer', async () => {
    const owner = new mongoose.Types.ObjectId();
    const exec = sinon.stub(mongoose.Query.prototype, 'exec').resolves([
      { user: owner, status: 'no', locationFuzzy: [48, 11] },
      { user: owner, status: 'no', locationFuzzy: [49, 12] },
    ]);
    try {
      const locations = await findDiscoveryOfferLocations(
        [owner],
        [],
        new Date(),
        { includeMeetings: true },
      );
      assert.deepEqual(
        locations,
        new Map([[owner.toString(), { type: 'meet', location: [48, 11] }]]),
      );
    } finally {
      exec.restore();
    }
  });
});
