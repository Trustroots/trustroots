const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
const controller: typeof import('../../server/controllers/admin.spam-cleanup.server.controller.mts') = require('../../server/controllers/admin.spam-cleanup.server.controller.mts');

type ObjectId = import('mongoose').Types.ObjectId;
interface Item {
  id: string;
  username: string;
  created: string | null;
  lastSeen: string | null;
  eligible: boolean;
  stage: string;
  selected?: boolean;
}
interface Body {
  message?: string;
  previewId: string;
  building: boolean;
  candidates: number;
  eligible: number;
  pages: number;
  items: Item[];
  deleted: number;
  skipped: number;
  done: boolean;
}

const users = mongoose.connection.collection('users');
const Preview = mongoose.model<{
  building: boolean;
  claimed?: boolean;
  formatVersion: number;
  accountIds: ObjectId[];
}>('SpamCleanupPreview');
const Chunk = mongoose.model<{ expiresAt: Date }>('SpamCleanupChunk');
const Audit = mongoose.model<{
  user: ObjectId;
  route: string;
  params: Record<string, unknown>;
  body: Record<string, unknown>;
}>('AuditLog');

function response() {
  return {
    statusCode: 200,
    body: undefined as unknown as Body,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body as Body;
      return this;
    },
    send(body: unknown) {
      this.body = body as Body;
      return this;
    },
  };
}

describe('Administrator spam account cleanup controller', () => {
  const admin = {
    _id: new mongoose.Types.ObjectId(),
    roles: ['user', 'admin'],
  };
  const inactiveSeen = new Date('2021-07-04T12:00:00Z');
  const recentSeen = new Date('2024-06-01T12:00:00Z');
  let serial = 0;

  function candidateDoc(seen: Date | null = inactiveSeen) {
    serial += 1;
    const username = `fictional-unit-${String(serial).padStart(5, '0')}`;
    return {
      username,
      email: `${username}@example.test`,
      created: new Date('2021-07-04T12:00:00Z'),
      ...(seen ? { seen } : {}),
      public: false,
      roles: ['user', 'suspended'],
      avatarUploaded: false,
    };
  }
  async function candidate(seen: Date | null = inactiveSeen) {
    return (await users.insertOne(candidateDoc(seen))).insertedId;
  }
  async function candidates(count: number) {
    await users.insertMany(Array.from({ length: count }, () => candidateDoc()));
  }
  async function preview(body: unknown = {}, actor: unknown = admin) {
    const res = response();
    await controller.preview({ body, user: actor } as never, res);
    return res;
  }
  async function fullPreview() {
    let res = await preview();
    while (res.body.building)
      res = await preview({ previewId: res.body.previewId });
    return res;
  }
  async function apply(
    previewId: unknown,
    overrides: Record<string, unknown> = {},
    actor: unknown = admin,
  ) {
    const res = response();
    await controller.apply(
      {
        body: {
          previewId,
          confirm: true,
          selection: 'all',
          accountIds: [],
          ...overrides,
        },
        user: actor,
      } as never,
      res,
    );
    return res;
  }
  async function routes() {
    return (await Audit.find().sort({ _id: 1 }).lean()).map(
      audit => audit.route,
    );
  }

  afterEach(async () => {
    sinon.restore();
    await utils.clearDatabase();
    await Preview.deleteMany({});
    await Chunk.deleteMany({});
  });

  describe('preview', () => {
    const invalid = { message: 'Invalid cleanup preview.' };

    it('refuses members who are not administrators', async () => {
      for (const actor of [undefined, { ...admin, roles: ['user'] }]) {
        for (const method of [controller.preview, controller.apply]) {
          const res = response();
          await method({ body: {}, user: actor } as never, res);
          assert.equal(res.statusCode, 403);
          assert.deepEqual(res.body, {
            message: 'Administrator access required.',
          });
        }
      }
    });

    it('rejects malformed preview IDs and selections', async () => {
      const oid = String(new mongoose.Types.ObjectId());
      const selected = {
        sort: 'selected',
        selectionMode: 'all',
        selectionStage: 'all',
        selectionIds: [],
      };
      for (const body of [
        '',
        { previewId: [oid] },
        { previewId: `x${oid}` },
        { previewId: `${oid}x` },
        { ...selected, selectionIds: [oid, 'invalid'] },
        { sort: 'account', selectionStage: 'all' },
        { sort: 'account', selectionIds: [] },
      ]) {
        const res = await preview(body);
        assert.equal(res.statusCode, 400, JSON.stringify(body));
        assert.deepEqual(res.body, invalid);
      }
      assert.equal(await Preview.countDocuments(), 0);
    });

    it('starts an audited preview without storing empty chunks', async () => {
      const res = await preview();
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.candidates, 0);
      assert.equal(
        await Chunk.countDocuments({ preview: res.body.previewId }),
        0,
      );
      const [audit] = await Audit.find().lean();
      assert.equal(String(audit.user), String(admin._id));
      assert.equal(audit.route, 'spam-cleanup/preview');
      assert.deepEqual(audit.params, { previewId: res.body.previewId });
    });

    it('explains unknown, outdated, applying and out-of-range previews', async () => {
      const unknown = await preview({
        previewId: String(new mongoose.Types.ObjectId()),
      });
      assert.equal(unknown.statusCode, 410);
      assert.deepEqual(unknown.body, {
        message: 'Preview unavailable or expired. Preview again.',
      });
      const review = await fullPreview();
      const { previewId } = review.body;
      const page = await preview({ previewId, page: 2 });
      assert.equal(page.statusCode, 400);
      assert.deepEqual(page.body, { message: 'Invalid cleanup page.' });
      await Preview.updateOne(
        { _id: previewId },
        { $set: { formatVersion: 1 } },
      );
      const outdated = await preview({ previewId });
      assert.equal(outdated.statusCode, 410);
      assert.deepEqual(outdated.body, {
        message: 'Preview format changed. Start a fresh preview.',
      });
      const outdatedApply = await apply(previewId);
      assert.equal(outdatedApply.statusCode, 410);
      assert.deepEqual(outdatedApply.body, {
        message: 'Preview format changed. Start a fresh preview.',
      });
      await Preview.updateOne(
        { _id: previewId },
        { $set: { formatVersion: 2 } },
      );
      await apply(previewId);
      const applying = await preview({ previewId });
      assert.equal(applying.statusCode, 409);
      assert.deepEqual(applying.body, {
        message:
          'This preview has started applying. Preview again to review remaining accounts.',
      });
    });

    it('reports storage failures without detail', async () => {
      sinon.stub(Audit.prototype, 'save').rejects(new Error('Fictional'));
      const res = await preview();
      assert.equal(res.statusCode, 500);
      assert.deepEqual(res.body, {
        message:
          'Unable to preview spam account cleanup. Start a fresh preview.',
      });
    });

    it('keeps other requests out while a scan chunk is built', async () => {
      await candidate();
      const record = (await Preview.create({
        actor: admin._id,
        expiresAt: new Date(Date.now() + 60000),
        scanSize: 1000,
        formatVersion: 2,
        building: true,
      } as never)) as unknown as { _id: ObjectId };
      const create = Chunk.create.bind(Chunk);
      let concurrent: ReturnType<typeof response> | undefined;
      let started = false;
      sinon.stub(Chunk, 'create').callsFake((async (...args: unknown[]) => {
        if (!started) {
          started = true;
          concurrent = await preview({ previewId: String(record._id) });
        }
        return (create as (...values: unknown[]) => unknown)(...args);
      }) as never);
      const built = await preview({ previewId: String(record._id) });
      assert.equal(built.statusCode, 200);
      assert.equal(built.body.candidates, 1);
      assert.equal(concurrent?.statusCode, 409);
      assert.deepEqual(concurrent?.body, {
        message: 'Preview is already being processed.',
      });
      const chunk = (await Chunk.findOne({ preview: record._id }).lean())!;
      const dayAhead = Date.now() + 24 * 60 * 60_000;
      assert.ok(Math.abs(chunk.expiresAt.getTime() - dayAhead) < 60_000);
    });

    it('describes each account on a page', async () => {
      const inactive = await candidate(inactiveSeen);
      const reviewed = await candidate(recentSeen);
      const unknown = await candidate(null);
      const noted = await candidate(inactiveSeen);
      const undated = await candidate(inactiveSeen);
      await mongoose
        .model('AdminNote')
        .create({ user: noted, note: 'Fictional protection' });
      const review = await fullPreview();
      await users.updateOne({ _id: undated }, { $unset: { created: '' } });
      const page = await preview({ previewId: review.body.previewId, page: 1 });
      assert.equal(page.statusCode, 200);
      const created = '2021-07-04T12:00:00.000Z';
      const item = (
        id: ObjectId,
        stage: string,
        lastSeen: Date | null,
        overrides: Partial<Item> = {},
      ) => ({
        id: String(id),
        stage,
        eligible: stage !== 'protected',
        created,
        lastSeen: lastSeen ? lastSeen.toISOString() : null,
        ...overrides,
      });
      assert.deepEqual(
        page.body.items.map(({ id, stage, eligible, created, lastSeen }) => ({
          id,
          stage,
          eligible,
          created,
          lastSeen,
        })),
        [
          item(inactive, 'inactive', inactiveSeen),
          item(reviewed, 'review', recentSeen),
          item(unknown, 'unknown-login', null),
          item(noted, 'protected', inactiveSeen),
          item(undated, 'inactive', inactiveSeen, { created: null }),
        ],
      );
      const sorted = await preview({
        previewId: review.body.previewId,
        sort: 'account',
      });
      assert.deepEqual(
        sorted.body.items.map(row => row.stage),
        ['inactive', 'review', 'unknown-login', 'protected', 'inactive'],
      );
    });

    it('pages 100 accounts from each scan chunk', async () => {
      await candidates(201);
      const review = await fullPreview();
      const { previewId } = review.body;
      assert.equal(review.body.items.length, 100);
      assert.equal(
        (await preview({ previewId, page: 2 })).body.items.length,
        100,
      );
      assert.equal(
        (await preview({ previewId, page: 3 })).body.items.length,
        1,
      );
    });

    it('sorts and selects only the requested preview', async () => {
      const first = await candidate();
      const older = await fullPreview();
      const second = await candidate();
      await fullPreview();
      for (const selectionStage of ['all', 'inactive', 'review']) {
        const res = await preview({
          previewId: older.body.previewId,
          sort: 'selected',
          selectionMode: 'all',
          selectionStage,
          selectionIds: [],
        });
        assert.equal(res.statusCode, 200, selectionStage);
        assert.deepEqual(
          res.body.items.map(row => [row.id, row.selected]),
          [[String(first), selectionStage !== 'review']],
        );
      }
      assert.notEqual(String(first), String(second));
    });
  });

  describe('apply', () => {
    it('rejects an unknown stage', async () => {
      const id = await candidate();
      const review = await fullPreview();
      const res = await apply(review.body.previewId, { stage: 'bogus' });
      assert.equal(res.statusCode, 400);
      assert.deepEqual(res.body, {
        message: 'Confirm the reviewed selection before deletion.',
      });
      assert.equal(await users.countDocuments({ _id: id }), 1);
    });

    it('explains unknown, unfinished and failed applies', async () => {
      const unknown = await apply(String(new mongoose.Types.ObjectId()));
      assert.equal(unknown.statusCode, 410);
      assert.deepEqual(unknown.body, {
        message: 'Preview unavailable or expired. Preview again.',
      });
      await candidates(1001);
      const building = await preview();
      assert.equal(building.body.building, true);
      const unfinished = await apply(building.body.previewId);
      assert.equal(unfinished.statusCode, 409);
      assert.deepEqual(unfinished.body, {
        message:
          'Finish previewing first and keep the reviewed selection unchanged during apply.',
      });
      await preview({ previewId: building.body.previewId });
      sinon.stub(Chunk, 'findOne').returns({
        lean: () => Promise.reject(new Error('Fictional')),
      } as never);
      const failed = await apply(building.body.previewId);
      assert.equal(failed.statusCode, 500);
      assert.deepEqual(failed.body, {
        message:
          'Cleanup interrupted. Start a fresh preview to check remaining accounts.',
      });
    });

    it('keeps other requests out while a chunk is applied', async () => {
      await candidate();
      const review = await fullPreview();
      const findOne = Chunk.findOne.bind(Chunk);
      let concurrent: ReturnType<typeof response> | undefined;
      let started = false;
      sinon.stub(Chunk, 'findOne').callsFake(((...args: unknown[]) => {
        const query = (
          findOne as (...values: unknown[]) => {
            lean(): Promise<unknown>;
          }
        )(...args);
        return {
          lean: async () => {
            if (!started) {
              started = true;
              concurrent = await apply(review.body.previewId);
            }
            return query.lean();
          },
        };
      }) as never);
      const applied = await apply(review.body.previewId);
      assert.deepEqual(applied.body, { deleted: 1, skipped: 0, done: true });
      assert.equal(concurrent?.statusCode, 409);
      assert.deepEqual(concurrent?.body, {
        message:
          'This preview is already being processed. Preview again if it was interrupted.',
      });
    });

    it('audits the start and the end of a cleanup once', async () => {
      await candidates(1001);
      const review = await fullPreview();
      const { previewId } = review.body;
      const selection = { selection: 'selected', accountIds: [] };
      assert.equal((await apply(previewId, selection)).body.done, false);
      const done = await apply(previewId, selection);
      assert.deepEqual(done.body, { deleted: 0, skipped: 0, done: true });
      assert.deepEqual((await apply(previewId, selection)).body, done.body);
      const audits = await Audit.find({
        route: { $in: ['spam-cleanup/apply', 'spam-cleanup/completed'] },
      })
        .sort({ _id: 1 })
        .lean();
      assert.deepEqual(
        audits.map(audit => ({
          user: String(audit.user),
          route: audit.route,
          params: audit.params,
          body: audit.body,
        })),
        [
          {
            user: String(admin._id),
            route: 'spam-cleanup/apply',
            params: { previewId },
            body: { reviewed: 1001 },
          },
          {
            user: String(admin._id),
            route: 'spam-cleanup/completed',
            params: { previewId },
            body: { deleted: 0, skipped: 0 },
          },
        ],
      );
      assert.ok((await routes()).includes('spam-cleanup/preview'));
    });

    it('stores the reviewed selection', async () => {
      const kept = await candidate();
      await candidate();
      const review = await fullPreview();
      await apply(review.body.previewId, { accountIds: [String(kept)] });
      const record = (await Preview.findById(review.body.previewId).lean())!;
      assert.deepEqual(record.accountIds.map(String), [String(kept)]);
      assert.equal(await users.countDocuments({ _id: kept }), 1);
    });
  });
});
