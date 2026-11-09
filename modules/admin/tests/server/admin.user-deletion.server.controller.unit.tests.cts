require('should');
const controller: typeof import('../../server/controllers/admin.user-deletion.server.controller.mts') = require('../../server/controllers/admin.user-deletion.server.controller.mts');

interface TestResponse {
  statusCode: number;
  body: unknown;
  status(code: number): this;
  send(body: unknown): this;
}

function response(): TestResponse {
  const result: TestResponse = {
    statusCode: 200,
    body: null,
    status(code) {
      result.statusCode = code;
      return result;
    },
    send(body) {
      result.body = body;
      return result;
    },
  };
  return result;
}

describe('Admin user deletion controller unit tests', () => {
  it('rejects unauthorised direct controller requests', async () => {
    const res = response();
    await controller.deleteMember({}, res);
    res.statusCode.should.equal(403);
  });

  it('rejects an administrator request without a body', async () => {
    const res = response();
    await controller.deleteMember(
      { user: { _id: 'admin-id', roles: ['admin'] } },
      res,
    );
    res.statusCode.should.equal(400);
  });
});

describe('Admin user deletion controller with stored members', () => {
  const mongoose: typeof import('mongoose') = require('mongoose');
  const sinon: typeof import('sinon') = require('sinon');
  const assert: typeof import('node:assert').strict =
    require('node:assert').strict;
  const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
  const User = mongoose.model<{ username: string; roles: string[] }>('User');
  const AuditLog = mongoose.model<{
    user: unknown;
    route: string;
    body: Record<string, unknown>;
  }>('AuditLog');
  const admin = {
    _id: String(new mongoose.Types.ObjectId()),
    roles: ['admin'],
  };
  let members: Array<{
    _id: import('mongoose').Types.ObjectId;
    username: string;
  }>;

  beforeEach(async () => {
    const raw = utils.generateUsersWithSharedPassword(3);
    raw[0].roles = ['user', 'suspended'];
    raw[1].roles = ['user', 'suspended'];
    raw[2].roles = ['user'];
    members = (await utils.saveUsersWithCachedPasswords(raw)) as never;
  });
  afterEach(async () => {
    sinon.restore();
    await utils.clearDatabase();
  });

  async function remove(
    body: Record<string, unknown>,
    user: { _id: string; roles: string[] } | null = admin,
  ) {
    const res = response();
    await controller.deleteMember({ user, body } as never, res);
    return { statusCode: res.statusCode, body: res.body };
  }
  function payload(overrides: Record<string, unknown> = {}) {
    return {
      id: String(members[0]._id),
      username: members[0].username,
      reason: 'Reviewed.',
      ...overrides,
    };
  }
  const invalid = {
    statusCode: 400,
    body: {
      message:
        'Enter the exact username and a reason of at most 1,000 characters.',
    },
  };

  it('rejects malformed input before looking up the member', async () => {
    const id = String(members[0]._id);
    for (const overrides of [
      { id: [id] },
      { id: 'x' + id },
      { id: id + 'x' },
      { username: 5 },
      { reason: ['a'] },
      { reason: 'a'.repeat(1001) },
      { keywords: Array.from({ length: 21 }, (_, i) => `keyword ${i}`) },
      { keywords: ['a'.repeat(81)] },
      { keywords: [5] },
    ]) {
      assert.deepEqual(await remove(payload(overrides)), invalid);
    }
    assert.ok(await User.exists({ _id: members[0]._id }));
    assert.equal(await AuditLog.countDocuments(), 0);
  });

  it('accepts limits measured after trimming and audits the request', async () => {
    const reason = 'r'.repeat(1000);
    const keywords = Array.from(
      { length: 20 },
      (_, i) => `  ${String(i).padStart(80, 'k')}  `,
    );
    const result = await remove(payload({ reason: `  ${reason}  `, keywords }));
    assert.equal(result.statusCode, 200);
    assert.equal(
      (result.body as { message: string }).message,
      'Member account deleted.',
    );
    assert.equal(await User.exists({ _id: members[0]._id }), null);
    const audit = (await AuditLog.findOne().lean())!;
    assert.equal(audit.route, '/api/admin/user/delete');
    assert.equal(String(audit.user), admin._id);
    assert.deepEqual(audit.body, {
      id: String(members[0]._id),
      username: members[0].username,
      reason,
      keywords: keywords.map(keyword => keyword.trim()),
    });
  });

  it('records no keywords when none are given', async () => {
    const result = await remove(
      payload({ id: String(members[1]._id), username: members[1].username }),
    );
    assert.equal(result.statusCode, 200);
    const audit = (await AuditLog.findOne().lean())!;
    assert.deepEqual(audit.body.keywords, []);
  });

  it('explains every refusal', async () => {
    assert.deepEqual(await remove(payload(), null), {
      statusCode: 403,
      body: { message: 'Administrator access required.' },
    });
    assert.deepEqual(
      await remove(payload(), {
        _id: String(members[0]._id),
        roles: ['admin'],
      }),
      {
        statusCode: 403,
        body: {
          message: 'You cannot delete your own account from administration.',
        },
      },
    );
    assert.deepEqual(
      await remove(payload({ id: String(new mongoose.Types.ObjectId()) })),
      { statusCode: 404, body: { message: 'Member not found.' } },
    );
    assert.deepEqual(
      await remove(
        payload({ id: String(members[2]._id), username: members[2].username }),
      ),
      {
        statusCode: 409,
        body: {
          message:
            'Only suspended members without administrator access can be deleted.',
        },
      },
    );
    assert.deepEqual(await remove(payload({ username: 'someone-else' })), {
      statusCode: 400,
      body: { message: 'The username confirmation does not match.' },
    });
    sinon.stub(User, 'findById').rejects(new Error('lookup unavailable'));
    assert.deepEqual(await remove(payload()), {
      statusCode: 500,
      body: {
        message:
          'Deletion could not be completed. Refresh the member report before trying again.',
      },
    });
  });
});
