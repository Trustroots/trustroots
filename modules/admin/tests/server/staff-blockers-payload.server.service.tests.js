const assert = require('assert/strict');
const {
  prepareStaffBlockers,
} = require('../../server/services/staff-blockers-payload.server.service.mjs');

describe('Staff-blocker response payload', () => {
  it('selects matching blockers without exposing blocked lists or private fields', () => {
    const staff = {
      _id: 'staff-id',
      username: 'staff-member',
      displayName: 'Staff Member',
      email: 'staff@example.test',
    };
    const blocker = {
      _id: 'blocker-id',
      username: 'another-member',
      displayName: 'Another Member',
      email: 'member@example.test',
      blocked: [{ equals: id => id === staff._id }],
    };
    const unrelated = {
      ...blocker,
      _id: 'unrelated-id',
      blocked: [{ equals: () => false }],
    };
    assert.deepEqual(prepareStaffBlockers([staff], [blocker, unrelated]), [
      {
        _id: staff._id,
        username: staff.username,
        displayName: staff.displayName,
        blockedBy: [
          {
            _id: blocker._id,
            username: blocker.username,
            displayName: blocker.displayName,
          },
        ],
      },
    ]);
  });

  it('preserves empty staff and blocker results', () => {
    assert.deepEqual(prepareStaffBlockers([], []), []);
    assert.deepEqual(prepareStaffBlockers([{ _id: 'staff-id' }], []), [
      {
        _id: 'staff-id',
        username: undefined,
        displayName: undefined,
        blockedBy: [],
      },
    ]);
  });
});
