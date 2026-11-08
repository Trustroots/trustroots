const mongoose: typeof import('mongoose') = require('mongoose');
const assert: typeof import('node:assert').strict =
  require('node:assert').strict;
const sinon: typeof import('sinon') = require('sinon');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
const controller: typeof import('../../server/controllers/admin.unsuspend.server.controller.mts') = require('../../server/controllers/admin.unsuspend.server.controller.mts');

interface Member {
  _id: import('mongoose').Types.ObjectId;
  roles: string[];
  authVersion?: number;
  username: string;
}
interface Audit {
  body: { outcome: string };
}
const User = mongoose.model<Member>('User');
const AuditLog = mongoose.model<Audit>('AuditLog');

type Captured = { statusCode: number; body: unknown };

async function unsuspend(
  body: Record<string, unknown> | undefined,
  user: { _id: unknown; roles: string[] } | null = {
    _id: new mongoose.Types.ObjectId(),
    roles: ['user', 'admin'],
  },
): Promise<Captured> {
  const captured: Captured = { statusCode: 200, body: undefined };
  const res = {
    status(code: number) {
      captured.statusCode = code;
      return res;
    },
    send(sent: unknown) {
      captured.body = sent;
      return res;
    },
  };
  await controller.unsuspendMember({ user, body } as never, res as never);
  return captured;
}

describe('Administrator unsuspension controller', () => {
  let member: Member;
  beforeEach(async () => {
    const raw = utils.generateUsersWithSharedPassword(1);
    raw[0].roles = ['user', 'suspended'];
    [member] = (await utils.saveUsersWithCachedPasswords(
      raw,
    )) as unknown as Member[];
  });
  afterEach(async () => {
    sinon.restore();
    await utils.clearDatabase();
  });
  function payload(overrides: Record<string, unknown> = {}) {
    return {
      id: String(member._id),
      confirmed: true,
      reason: 'Reviewed a fictional suspension.',
      ...overrides,
    };
  }
  async function roles() {
    return (await User.findById(member._id).lean())!.roles;
  }

  it('refuses members who are not administrators', async () => {
    for (const user of [null, { _id: member._id, roles: ['user'] }]) {
      assert.deepEqual(await unsuspend(payload(), user), {
        statusCode: 403,
        body: { message: 'Administrator access required.' },
      });
    }
    assert.ok((await roles()).includes('suspended'));
  });

  it('requires a well-formed member ID', async () => {
    const id = String(member._id);
    for (const bad of [[id], 'x' + id, id + 'x']) {
      assert.deepEqual(await unsuspend(payload({ id: bad })), {
        statusCode: 400,
        body: { message: 'A valid member ID is required.' },
      });
    }
    assert.ok((await roles()).includes('suspended'));
  });

  it('requires confirmation and a reason of at most 1,000 characters', async () => {
    assert.deepEqual(await unsuspend(payload({ reason: 'a'.repeat(1001) })), {
      statusCode: 400,
      body: {
        message:
          'Confirm unsuspension and give a reason of at most 1,000 characters.',
      },
    });
    assert.ok((await roles()).includes('suspended'));
    // Surrounding whitespace does not count towards the limit.
    assert.deepEqual(
      await unsuspend(payload({ reason: `  ${'a'.repeat(1000)}  ` })),
      {
        statusCode: 200,
        body: { changed: true, message: 'Member unsuspended.' },
      },
    );
    assert.deepEqual(await roles(), ['user']);
  });

  it('reports missing and already unsuspended members', async () => {
    assert.deepEqual(
      await unsuspend(payload({ id: String(new mongoose.Types.ObjectId()) })),
      { statusCode: 404, body: { message: 'Member not found.' } },
    );
    await User.updateOne({ _id: member._id }, { $set: { roles: ['user'] } });
    assert.deepEqual(await unsuspend(payload()), {
      statusCode: 200,
      body: { changed: false, message: 'Member is already unsuspended.' },
    });
  });

  it('detects an auth version added after the member was read', async () => {
    // Another session sets the auth version between the read and the write,
    // including to a null value that a missing field would also match.
    for (const authVersion of [3, null]) {
      await User.updateOne({ _id: member._id }, { $unset: { authVersion: 1 } });
      const snapshot = (await User.findById(member._id).lean())!;
      assert.equal(snapshot.authVersion, undefined);
      const query = {
        select: () => query,
        lean: () => query,
        exec: async () => {
          await User.collection.updateOne(
            { _id: member._id },
            { $set: { authVersion } },
          );
          return snapshot;
        },
      };
      sinon.stub(User, 'findById').returns(query as never);
      assert.deepEqual(await unsuspend(payload()), {
        statusCode: 409,
        body: {
          message:
            'The member state changed. Refresh the report and review the suspension again.',
        },
      });
      sinon.restore();
      assert.ok((await roles()).includes('suspended'));
    }
    const audits = await AuditLog.find().lean();
    assert.deepEqual(
      audits.map(audit => audit.body.outcome),
      ['conflict', 'conflict'],
    );
  });
});
