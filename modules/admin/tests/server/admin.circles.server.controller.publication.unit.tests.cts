const assert: typeof import('node:assert').strict =
  require('node:assert').strict;
const realFs: typeof import('node:fs') = require('node:fs');
const os: typeof import('node:os') = require('node:os');
const path: typeof import('node:path') = require('node:path');
const realSharp: typeof import('sharp') = require('sharp');
const sinon: typeof import('sinon') = require('sinon');
const proxyquire: typeof import('../../../../testutils/server/mock-module.mts').default = require('../../../../testutils/server/mock-module');

type Stub = import('sinon').SinonStub;
type Controller =
  typeof import('../../server/controllers/admin.circles.server.controller.mts').default;
type FileSystem = Record<
  'mkdir' | 'chmod' | 'open' | 'rename' | 'rm' | 'stat',
  Stub
>;
interface Circle {
  _id: string;
  slug?: string;
  label?: string;
  image?: boolean;
  public?: boolean;
  save: Stub;
  validate: Stub;
  toJSON(): Record<string, unknown>;
}
interface MockResponse {
  statusCode: number;
  body: { message?: string; [key: string]: unknown };
  status(code: number): MockResponse;
  json(body: unknown): MockResponse;
  send(body: unknown): MockResponse;
}

function response(): MockResponse {
  return {
    statusCode: 200,
    body: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body as MockResponse['body'];
      return this;
    },
    send(body) {
      return this.json(body);
    },
  };
}

// Drives the controller with the real error service, so responses carry the
// message a client would actually receive.
describe('Admin circles controller image publication', () => {
  let controller: Controller;
  let fs: FileSystem;
  let sharp: Stub;
  let image: Record<
    'metadata' | 'rotate' | 'jpeg' | 'webp' | 'resize' | 'toFile',
    Stub
  >;
  let lockHandle: Record<'writeFile' | 'close', Stub>;
  let circle: Circle;
  let query: Record<'select' | 'sort' | 'exec', Stub>;
  let config: { circleImagesDir: string };
  let log: Stub;
  let res: MockResponse;
  const failure = new Error('Storage unavailable');
  const missing = Object.assign(new Error('Missing'), { code: 'ENOENT' });
  const busy = Object.assign(new Error('busy'), { code: 'EEXIST' });
  const lock = '/circle-images/.staging-lock-walkers';
  const upload = {
    params: { circle: 'circle-1' },
    body: { label: 'Walkers' },
    file: { path: '/upload.png' },
  };

  beforeEach(() => {
    circle = {
      _id: 'circle-1',
      slug: 'walkers',
      image: false,
      public: false,
      save: sinon.stub(),
      validate: sinon.stub().resolves(),
      toJSON: () => ({ ...circle }),
    };
    circle.save.resolves(circle);
    const Tribe = Object.assign(
      sinon.stub().callsFake((data: Partial<Circle>) => {
        Object.assign(circle, data);
        return circle;
      }),
      { find: sinon.stub(), findById: sinon.stub() },
    );
    query = {
      select: sinon.stub().returnsThis(),
      sort: sinon.stub().returnsThis(),
      exec: sinon.stub().resolves(circle),
    };
    Tribe.find.returns(query);
    Tribe.findById.returns(query);
    lockHandle = {
      writeFile: sinon.stub().resolves(),
      close: sinon.stub().resolves(),
    };
    fs = {
      mkdir: sinon.stub().resolves(),
      chmod: sinon.stub().resolves(),
      open: sinon.stub().resolves(lockHandle),
      rename: sinon.stub().resolves(),
      rm: sinon.stub().resolves(),
      stat: sinon.stub().resolves({ mtimeMs: 0 }),
    };
    image = {
      metadata: sinon.stub().resolves({ width: 8, height: 8 }),
      rotate: sinon.stub().returnsThis(),
      jpeg: sinon.stub().returnsThis(),
      webp: sinon.stub().returnsThis(),
      resize: sinon.stub().returnsThis(),
      toFile: sinon.stub().resolves(),
    };
    sharp = sinon.stub().returns(image);
    config = { circleImagesDir: '/circle-images' };
    log = sinon.stub();
    controller = proxyquire<Controller>(
      require.resolve('../../server/controllers/admin.circles.server.controller.mts'),
      {
        mongoose: { model: () => Tribe },
        'node:fs': { promises: fs },
        sharp,
        '../../../../config/config': config,
        '../../../../config/lib/logger': log,
        '../../../core/server/services/file-upload.service': {
          uploadFile: sinon.stub(),
        },
      },
    );
    res = response();
  });

  afterEach(() => {
    sinon.restore();
  });

  const renamed = (from: RegExp, to: string) =>
    fs.rename
      .getCalls()
      .some(call => from.test(call.args[0]) && call.args[1] === to);

  it('reports validation messages without logging them', async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ color: 'zzzzzz' }, 'Please choose a valid colour.'],
      [{ color: 'z1e3a8a' }, 'Please choose a valid colour.'],
      [{ color: '1e3a8az' }, 'Please choose a valid colour.'],
      [
        { description: 'x'.repeat(4001) },
        'Please keep the description under 4000 characters.',
      ],
    ];
    for (const [body, message] of cases) {
      res = response();
      await controller.create({ body: { label: 'Walkers', ...body } }, res);
      assert.equal(res.statusCode, 400);
      assert.deepEqual(res.body, { message });
    }
    sinon.assert.notCalled(log);
    sinon.assert.notCalled(circle.save);
  });

  it('accepts a description of exactly 4000 characters', async () => {
    const description = 'x'.repeat(4000);
    await controller.create({ body: { label: 'Walkers', description } }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.description, description);
  });

  for (const error of [failure, 'fictional failure'])
    it(`logs and reports the unexpected failure ${error}`, async () => {
      query.exec.callsFake(() => Promise.reject(error));
      await controller.list({}, res);
      assert.equal(res.statusCode, 400);
      assert.equal(typeof res.body.message, 'string');
      sinon.assert.calledOnceWithExactly(
        log,
        'error',
        'Failed to process circle administration request.',
        { error },
      );
    });

  it('rejects unsafe slugs before touching the image store', async () => {
    for (const slug of ['walkers/../../outside', 'walkers.', '-walkers']) {
      circle.slug = slug;
      res = response();
      await controller.update(upload, res);
      assert.equal(res.statusCode, 400, slug);
      assert.deepEqual(res.body, {
        message: 'Circle slug is not safe for image storage.',
      });
    }
    sinon.assert.notCalled(fs.open);
    sinon.assert.notCalled(sharp);
    sinon.assert.notCalled(log);
  });

  it('publishes images for hyphenated slugs', async () => {
    circle.slug = 'long-distance-walkers';
    await controller.update(upload, res);
    assert.equal(res.statusCode, 200);
    assert(
      renamed(/\/canonical\.jpg$/, '/circle-images/long-distance-walkers.jpg'),
    );
  });

  it('writes the process id into the lock file and closes it', async () => {
    await controller.update(upload, res);
    assert.equal(res.statusCode, 200);
    sinon.assert.calledOnceWithExactly(
      lockHandle.writeFile,
      String(process.pid),
    );
    sinon.assert.calledOnce(lockHandle.close);
  });

  it('removes a stale lock before retrying, but keeps a live one', async () => {
    fs.open.onCall(0).rejects(busy);
    fs.stat.resolves({ mtimeMs: Date.now() - 130_000 });
    await controller.update(upload, res);
    assert.equal(res.statusCode, 200);
    // Once for the stale lock and once when this update releases its own.
    assert.equal(fs.rm.withArgs(lock).callCount, 2);

    fs.rm.resetHistory();
    fs.open.reset();
    fs.open.onCall(0).rejects(busy);
    fs.open.resolves(lockHandle);
    fs.stat.resolves({ mtimeMs: Date.now() });
    res = response();
    await controller.update(upload, res);
    assert.equal(res.statusCode, 200);
    assert.equal(fs.rm.withArgs(lock).callCount, 1);
  });

  it('treats a lock exactly at the staleness limit as live', async () => {
    const clock = sinon.useFakeTimers({
      now: 1_000_000,
      toFake: ['Date', 'setTimeout'],
    });
    fs.open.onCall(0).rejects(busy);
    fs.stat.resolves({ mtimeMs: 1_000_000 - 120_000 });
    const pending = controller.update(upload, res);
    await clock.tickAsync(25);
    await pending;
    assert.equal(res.statusCode, 200);
    assert.equal(fs.rm.withArgs(lock).callCount, 1);
  });

  it('gives up exactly when the lock wait deadline is reached', async () => {
    const clock = sinon.useFakeTimers({
      now: 1_000_000,
      toFake: ['Date', 'setTimeout'],
    });
    fs.open.rejects(busy);
    fs.stat.resolves({ mtimeMs: 1_000_000 });
    const pending = controller.update(upload, res);
    await clock.tickAsync(30_000);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, {
      message: 'Another update of this circle image is in progress.',
    });
    await clock.tickAsync(1_000);
    await pending;
    sinon.assert.notCalled(log);
  });

  it('accepts images at exactly the pixel limit and reports larger ones', async () => {
    for (const [height, statusCode] of [
      [5_000, 201],
      [5_001, 400],
    ]) {
      image.metadata.resolves({ width: 10_000, height });
      res = response();
      await controller.create(
        { body: { label: 'Walkers' }, file: upload.file },
        res,
      );
      assert.equal(res.statusCode, statusCode);
    }
    assert.deepEqual(res.body, {
      message:
        'Upload a valid JPEG, PNG, or GIF image with no more than 50 million pixels.',
    });
  });

  it('keeps the published image when generation fails before the swap', async () => {
    image.toFile.rejects(failure);
    await controller.update(upload, res);
    assert.equal(res.statusCode, 400);
    sinon.assert.neverCalledWith(fs.rm, '/circle-images/walkers.jpg');
    sinon.assert.neverCalledWith(fs.rm, '/circle-images/walkers');
    sinon.assert.notCalled(fs.rename);
  });

  it('restores both previous canonical and variants when publication fails after the swap', async () => {
    fs.rename.callsFake(async (from: string, to: string) => {
      if (String(from).endsWith('/variants') && to === '/circle-images/walkers')
        throw failure;
    });
    await controller.update(upload, res);
    assert.equal(res.statusCode, 400);
    assert(renamed(/previous-canonical\.jpg$/, '/circle-images/walkers.jpg'));
    assert(renamed(/previous-variants$/, '/circle-images/walkers'));
  });

  it('does not restore backups that were never made', async () => {
    fs.rename.callsFake(async (from: string, to: string) => {
      if (String(to).includes('previous-')) throw missing;
      if (String(from).endsWith('/variants') && to === '/circle-images/walkers')
        throw failure;
    });
    await controller.update(upload, res);
    assert.equal(res.statusCode, 400);
    assert(!renamed(/previous-canonical\.jpg$/, '/circle-images/walkers.jpg'));
    assert(!renamed(/previous-variants$/, '/circle-images/walkers'));
  });

  it('keeps the new images when cleanup fails after the circle is saved', async () => {
    fs.rm.callsFake(async (target: string) => {
      if (/\/\.staging-walkers-/.test(target)) throw failure;
    });
    await controller.update(upload, res);
    assert.equal(res.statusCode, 400);
    sinon.assert.calledOnce(circle.save);
    assert(!renamed(/previous-canonical\.jpg$/, '/circle-images/walkers.jpg'));
    assert(!renamed(/previous-variants$/, '/circle-images/walkers'));
  });

  it('publishes canonical and variant files in the expected formats and qualities, then removes staging', async () => {
    const directory = await realFs.promises.mkdtemp(
      path.join(os.tmpdir(), 'circle-publication-'),
    );
    config.circleImagesDir = directory;
    for (const name of Object.keys(fs) as Array<keyof FileSystem>) {
      fs[name].callsFake((...args: unknown[]) =>
        Reflect.apply(realFs.promises[name], realFs.promises, args),
      );
    }
    sharp.callsFake(realSharp);
    const source = path.join(directory, 'upload.png');
    try {
      await realSharp({
        create: { width: 64, height: 48, channels: 3, background: '#3a6ea5' },
      })
        .composite([
          {
            input: Buffer.from(
              '<svg width="64" height="48"><circle cx="20" cy="20" r="14" fill="#f5c542"/></svg>',
            ),
          },
        ])
        .png()
        .toFile(source);
      const uploaded = await realFs.promises.readFile(source);
      await controller.create(
        { body: { label: 'Walkers' }, file: { path: source } },
        res,
      );
      assert.equal(res.statusCode, 201);
      const canonical = await realFs.promises.readFile(
        path.join(directory, 'walkers.jpg'),
      );
      const expectedCanonical = await realSharp(uploaded)
        .rotate()
        .jpeg({ quality: 85 })
        .toBuffer();
      assert(canonical.equals(expectedCanonical), 'canonical quality 85');
      const size = { width: 120, height: 120, fit: 'cover' as const };
      for (const [extension, format] of [
        ['jpg', 'jpeg'],
        ['webp', 'webp'],
      ] as const) {
        const variant = await realFs.promises.readFile(
          path.join(directory, 'walkers', `120x120.${extension}`),
        );
        assert.equal((await realSharp(variant).metadata()).format, format);
        const expected = await realSharp(canonical)
          .resize(size)
          [format]({ quality: 72 })
          .toBuffer();
        assert(variant.equals(expected), `${format} variant quality 72`);
      }
      const leftovers = (await realFs.promises.readdir(directory)).filter(
        name => name.startsWith('.staging'),
      );
      assert.deepEqual(leftovers, []);
    } finally {
      await realFs.promises.rm(directory, { recursive: true, force: true });
    }
  });
});
