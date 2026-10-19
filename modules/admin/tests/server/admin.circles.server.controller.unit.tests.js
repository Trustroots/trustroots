const assert = require('assert');
const mongoose = require('mongoose');
const realFs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const realSharp = require('sharp');
const urlslugs =
  require('../../../../config/lib/mongoose-url-slugs.mjs').default;
const sinon = require('sinon');
const proxyquire = require('../../../../testutils/server/mock-module');

function response() {
  const res = { statusCode: 200 };
  res.status = code => {
    res.statusCode = code;
    return res;
  };
  res.json = res.send = body => {
    res.body = body;
    return res;
  };
  return res;
}

describe('Admin circles controller', () => {
  let controller;
  let Tribe;
  let fs;
  let sharp;
  let image;
  let lockHandle;
  let uploadFile;
  let circle;
  let query;
  let config;
  let res;
  const failure = new Error('Storage unavailable');
  const missing = Object.assign(new Error('Missing'), { code: 'ENOENT' });

  afterEach(() => {
    sinon.restore();
  });

  beforeEach(() => {
    circle = { _id: 'circle-1', slug: 'walkers', image: false, public: false };
    circle.save = sinon.stub().resolves(circle);
    circle.validate = sinon.stub().resolves();
    circle.toJSON = () => ({ ...circle });
    Tribe = sinon.stub().callsFake(data => {
      Object.assign(circle, data);
      return circle;
    });
    query = {
      select: sinon.stub().returnsThis(),
      sort: sinon.stub().returnsThis(),
      exec: sinon.stub().resolves(circle),
    };
    Tribe.find = sinon.stub().returns(query);
    Tribe.findById = sinon.stub().returns(query);
    Tribe.findByIdAndDelete = sinon.stub().resolves();
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
      rotate: sinon.stub().returnsThis(),
      jpeg: sinon.stub().returnsThis(),
      webp: sinon.stub().returnsThis(),
      resize: sinon.stub().returnsThis(),
      toFile: sinon.stub().resolves(),
    };
    sharp = sinon.stub().returns(image);
    uploadFile = sinon.stub();
    config = { circleImagesDir: '/circle-images' };
    controller = proxyquire(
      require.resolve('../../server/controllers/admin.circles.server.controller.mjs'),
      {
        mongoose: { model: () => Tribe },
        'node:fs': { promises: fs },
        sharp,
        '../../../../config/config': config,
        '../../../core/server/services/error.server.service': {
          getErrorMessage: err => err.message,
        },
        '../../../core/server/services/file-upload.service': { uploadFile },
      },
    );
    res = response();
  });

  it('lists the catalogue sorted by label', async () => {
    query.exec.resolves([circle]);
    await controller.list({}, res);
    assert.deepStrictEqual(res.body, [circle]);
    sinon.assert.calledWith(query.sort, { label: 1 });
    sinon.assert.calledOnce(query.select);
  });

  it('reads an existing circle', async () => {
    await controller.get({ params: { circle: 'circle-1' } }, res);
    assert.strictEqual(res.body, circle);
    sinon.assert.calledWith(Tribe.findById, 'circle-1');
  });

  for (const method of ['get', 'update']) {
    it(`${method} returns 404 for an absent circle`, async () => {
      query.exec.resolves(null);
      await controller[method]({ params: { circle: 'missing' } }, res);
      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.message, 'Circle not found.');
    });
  }

  for (const method of ['list', 'get', 'update']) {
    it(`${method} reports database errors`, async () => {
      query.exec.rejects(failure);
      await controller[method]({ params: { circle: 'circle-1' } }, res);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.message, failure.message);
    });
  }

  for (const [value, expected] of [
    [undefined, true],
    [false, false],
    [true, true],
    ['true', true],
    ['false', false],
  ]) {
    it(`creates with public=${value}`, async () => {
      await controller.create(
        {
          body: {
            label: 'Walkers',
            public: value,
            attribution: '',
            attribution_url: '',
          },
        },
        res,
      );
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.public, expected);
      assert.strictEqual(res.body.attribution, undefined);
      assert.strictEqual(res.body.attribution_url, undefined);
      sinon.assert.notCalled(sharp);
    });
  }

  it('updates optional metadata and preserves omitted visibility', async () => {
    await controller.update(
      {
        params: { circle: 'circle-1' },
        body: {
          label: 'Walkers',
          attribution: 'Example artist',
          attribution_url: 'https://example.org',
        },
      },
      res,
    );
    assert.strictEqual(res.body.public, false);
    assert.strictEqual(res.body.attribution, 'Example artist');
    assert.strictEqual(res.body.attribution_url, 'https://example.org');
    assert(res.body.modified instanceof Date);
  });

  for (const method of ['create', 'update']) {
    it(`${method} generates canonical and responsive images and removes the upload`, async () => {
      await controller[method](
        {
          params: { circle: 'circle-1' },
          body: { label: 'Walkers' },
          file: { path: '/upload.png' },
        },
        res,
      );
      assert.strictEqual(res.body.image, true);
      sinon.assert.calledOnce(circle.save);
      sinon.assert.calledWith(
        fs.mkdir,
        sinon.match(/\/circle-images\/\.staging-walkers-[^/]+\/variants$/),
        sinon.match({ recursive: true }),
      );
      sinon.assert.calledWith(image.toFile, sinon.match(/\/canonical\.jpg$/));
      for (const size of ['120x120', '742x496', '906x240', '1400x900']) {
        for (const ext of ['jpg', 'webp'])
          sinon.assert.calledWith(
            image.toFile,
            sinon.match(new RegExp(`/variants/${size}\\.${ext}$`)),
          );
      }
      sinon.assert.calledWith(
        fs.rename,
        sinon.match(/\/canonical\.jpg$/),
        '/circle-images/walkers.jpg',
      );
      sinon.assert.calledWith(
        fs.rename,
        sinon.match(/\/variants$/),
        '/circle-images/walkers',
      );
      sinon.assert.calledWith(image.rotate);
      sinon.assert.calledWith(sharp, '/upload.png', {
        animated: false,
        limitInputPixels: 50_000_000,
      });
      sinon.assert.calledWith(
        fs.open,
        '/circle-images/.staging-lock-walkers',
        'wx',
        0o600,
      );
      sinon.assert.calledWith(fs.rm, '/circle-images/.staging-lock-walkers', {
        recursive: true,
        force: true,
      });
      sinon.assert.calledWith(fs.rm, '/upload.png', {
        recursive: true,
        force: true,
      });
    });
  }

  it('publishes real image variants with web-server traversal permissions', async () => {
    const directory = await realFs.promises.mkdtemp(
      path.join(os.tmpdir(), 'circle-images-'),
    );
    config.circleImagesDir = directory;
    for (const name of Object.keys(fs)) {
      fs[name].callsFake(realFs.promises[name].bind(realFs.promises));
    }
    sharp.callsFake(realSharp);
    const upload = path.join(directory, 'upload.png');
    try {
      await realSharp({
        create: { width: 8, height: 8, channels: 3, background: '#123456' },
      })
        .png()
        .toFile(upload);
      await controller.create(
        { body: { label: 'Walkers' }, file: { path: upload } },
        res,
      );
      assert.strictEqual(res.statusCode, 201);
      const variants = path.join(directory, 'walkers');
      assert.strictEqual(
        (await realFs.promises.stat(variants)).mode & 0o777,
        0o755,
      );
      for (const size of ['120x120', '742x496', '906x240', '1400x900']) {
        for (const extension of ['jpg', 'webp']) {
          const metadata = await realSharp(
            path.join(variants, `${size}.${extension}`),
          ).metadata();
          assert.strictEqual(`${metadata.width}x${metadata.height}`, size);
        }
      }
    } finally {
      await realFs.promises.rm(directory, { recursive: true, force: true });
    }
  });

  it('rolls back a colliding create without regenerating its published slug', async () => {
    const schema = new mongoose.Schema({
      label: String,
      image: Boolean,
      modified: Date,
    });
    schema.plugin(urlslugs('label', { generator: () => 'walkers' }));
    const Probe =
      mongoose.models.AdminCircleCollisionProbe ||
      mongoose.model('AdminCircleCollisionProbe', schema);
    const find = sinon.stub(Probe, 'find');
    find.onFirstCall().returns({ exec: async () => [] });
    // A competing create commits after initial validation. A second validation
    // would silently choose walkers-2, after publishing this upload at walkers.
    find.returns({ exec: async () => [{ get: () => 'walkers' }] });
    const duplicate = Object.assign(new Error('Duplicate slug'), {
      code: 11000,
    });
    const insert = sinon.stub(Probe.collection, 'insertOne').rejects(duplicate);
    Tribe.callsFake(data => new Probe(data));
    await controller.create(
      { body: { label: 'Walkers!' }, file: { path: '/upload.png' } },
      res,
    );
    assert.strictEqual(res.statusCode, 400);
    sinon.assert.calledOnce(find);
    sinon.assert.calledOnce(insert);
    assert.strictEqual(insert.firstCall.args[0].slug, 'walkers');
    sinon.assert.calledWith(
      fs.rename,
      sinon.match(/previous-variants$/),
      '/circle-images/walkers',
    );
  });

  it('keeps existing images when setting publication permissions fails', async () => {
    fs.chmod.rejects(failure);
    await controller.update(
      {
        params: { circle: 'circle-1' },
        body: { label: 'Walkers' },
        file: { path: '/upload.png' },
      },
      res,
    );
    assert.strictEqual(res.statusCode, 400);
    sinon.assert.notCalled(circle.save);
    sinon.assert.notCalled(fs.rename);
  });

  it('reports validation failures before any circle is saved', async () => {
    circle.save.rejects(failure);
    await controller.create({ body: {} }, res);
    assert.strictEqual(res.statusCode, 400);
    sinon.assert.notCalled(Tribe.findByIdAndDelete);
  });

  it('cleans failed uploads even before the first save', async () => {
    circle.save.rejects(failure);
    await controller.create({ body: {}, file: { path: '/upload.png' } }, res);
    assert.strictEqual(res.statusCode, 400);
    sinon.assert.calledWith(fs.rm, '/upload.png', {
      recursive: true,
      force: true,
    });
  });

  it('leaves existing assets in place when image generation fails', async () => {
    image.toFile.rejects(failure);
    await controller.create(
      {
        body: { label: 'Walkers', color: '1e3a8a' },
        file: { path: '/upload.png' },
      },
      res,
    );
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.message, failure.message);
    sinon.assert.notCalled(circle.save);
    sinon.assert.notCalled(Tribe.findByIdAndDelete);
    sinon.assert.notCalled(fs.rename);
    sinon.assert.calledWith(fs.rm, sinon.match(/\/\.staging-walkers-/), {
      recursive: true,
      force: true,
    });
  });

  it('cleans an upload when the update target is absent', async () => {
    query.exec.resolves(null);
    await controller.update({ params: {}, file: { path: '/upload.png' } }, res);
    assert.strictEqual(res.statusCode, 404);
    sinon.assert.calledOnce(fs.rm);
  });

  it('ignores missing temporary uploads during cleanup', async () => {
    fs.rm.rejects(missing);
    await controller.create({ body: {}, file: { path: '/upload.png' } }, res);
    assert.strictEqual(res.statusCode, 201);
  });

  it('surfaces unexpected cleanup failures', async () => {
    fs.rm.rejects(failure);
    await assert.rejects(
      controller.update(
        { params: {}, body: {}, file: { path: '/upload.png' } },
        res,
      ),
      /Storage unavailable/,
    );
  });

  it('keeps image files on the original slug when a save changes it', async () => {
    circle.image = true;
    circle.save.callsFake(async () => {
      circle.slug = 'renamed';
      return circle;
    });
    await controller.update({ params: {}, body: {} }, res);
    assert.strictEqual(res.statusCode, 200);
    sinon.assert.notCalled(fs.rename);
    sinon.assert.notCalled(fs.open);
  });

  it('passes JSON requests through the upload middleware', () => {
    const next = sinon.spy();
    controller.processImageUpload({ is: () => false }, res, next);
    sinon.assert.calledOnce(next);
    sinon.assert.notCalled(uploadFile);
  });

  it('rejects a non-hexadecimal colour before saving or processing', async () => {
    for (const color of ['zzzzzz', 123456]) {
      await controller.create({ body: { label: 'Walkers', color } }, res);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.message, 'Please choose a valid colour.');
    }
    sinon.assert.notCalled(circle.save);
    sinon.assert.notCalled(sharp);
  });

  it('rejects an oversized or non-text description before saving', async () => {
    for (const description of ['x'.repeat(4001), 12]) {
      await controller.create(
        { body: { label: 'Walkers', color: '1e3a8a', description } },
        res,
      );
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(
        res.body.message,
        'Please keep the description under 4000 characters.',
      );
    }
    sinon.assert.notCalled(circle.save);
  });

  it('keeps the stored colour when the submitted colour is blank', async () => {
    circle.color = 'e74c3c';
    await controller.update(
      {
        params: { circle: 'circle-1' },
        body: { label: 'Walkers', color: '' },
      },
      res,
    );
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(circle.color, 'e74c3c');
  });

  for (const slug of ['../outside', undefined]) {
    it(`rejects an unsafe or absent slug (${slug}) before writing image files`, async () => {
      circle.slug = slug;
      await controller.update(
        {
          params: { circle: 'circle-1' },
          body: { label: 'Walkers', color: '1e3a8a' },
          file: { path: '/upload.png' },
        },
        res,
      );
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(
        res.body.message,
        'Circle slug is not safe for image storage.',
      );
      sinon.assert.notCalled(sharp);
      sinon.assert.notCalled(circle.save);
    });
  }

  it('unsets cleared attribution fields', async () => {
    const document = new mongoose.Schema({
      label: String,
      color: String,
      public: Boolean,
      attribution: String,
      attribution_url: String,
      description: String,
      image: Boolean,
      slug: String,
      modified: Date,
    });
    const Probe =
      mongoose.models.AdminCircleUnsetProbe ||
      mongoose.model('AdminCircleUnsetProbe', document);
    const stored = new Probe();
    stored.init({
      _id: new mongoose.Types.ObjectId(),
      label: 'Walkers',
      color: '1e3a8a',
      public: true,
      attribution: 'Artist',
      attribution_url: 'https://example.org/artist',
      description: 'Keep',
      image: false,
      slug: 'walkers',
    });
    stored.save = sinon.stub().resolves(stored);
    stored.validate = sinon.stub().resolves();
    stored.toJSON = () => stored.toObject();
    query.exec.resolves(stored);
    await controller.update(
      {
        params: { circle: 'circle-1' },
        body: {
          label: 'Walkers',
          color: 'e74c3c',
          public: true,
          attribution: '   ',
          attribution_url: '',
          description: 'Keep',
        },
      },
      res,
    );
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(stored.getChanges().$unset, {
      attribution: 1,
      attribution_url: 1,
    });
    assert.strictEqual(stored.color, 'e74c3c');
  });

  it('restores the previous image when saving fails after processing', async () => {
    circle.image = true;
    circle.save.rejects(failure);
    await controller.update(
      {
        params: { circle: 'circle-1' },
        body: { label: 'Walkers', color: '1e3a8a' },
        file: { path: '/upload.png' },
      },
      res,
    );
    assert.strictEqual(res.statusCode, 400);
    sinon.assert.calledWith(
      fs.rename,
      sinon.match(/previous-canonical\.jpg$/),
      '/circle-images/walkers.jpg',
    );
    sinon.assert.calledWith(
      fs.rename,
      sinon.match(/previous-variants$/),
      '/circle-images/walkers',
    );
  });

  it('publishes generated images when no previous files exist', async () => {
    fs.rename.callsFake(async (_from, to) => {
      if (String(to).includes('previous-')) throw missing;
    });
    await controller.create(
      {
        body: { label: 'Walkers', color: '1e3a8a' },
        file: { path: '/upload.png' },
      },
      res,
    );
    assert.strictEqual(res.statusCode, 201);
    sinon.assert.calledWith(
      fs.rename,
      sinon.match(/\/canonical\.jpg$/),
      '/circle-images/walkers.jpg',
    );
  });

  it('restores previous files when publication fails', async () => {
    fs.rename.callsFake(async (from, to) => {
      if (
        String(from).endsWith('/variants') &&
        to === '/circle-images/walkers'
      ) {
        throw failure;
      }
    });
    await controller.create(
      {
        body: { label: 'Walkers', color: '1e3a8a' },
        file: { path: '/upload.png' },
      },
      res,
    );
    assert.strictEqual(res.statusCode, 400);
    sinon.assert.notCalled(circle.save);
    sinon.assert.calledWith(
      fs.rename,
      sinon.match(/previous-canonical\.jpg$/),
      '/circle-images/walkers.jpg',
    );
  });

  it('restores a moved canonical image when variant backup fails', async () => {
    fs.rename.callsFake(async (_from, to) => {
      if (String(to).endsWith('previous-variants')) throw failure;
    });
    await controller.create(
      {
        body: { label: 'Walkers', color: '1e3a8a' },
        file: { path: '/upload.png' },
      },
      res,
    );
    assert.strictEqual(res.statusCode, 400);
    sinon.assert.notCalled(circle.save);
    sinon.assert.calledWith(
      fs.rename,
      sinon.match(/previous-canonical\.jpg$/),
      '/circle-images/walkers.jpg',
    );
  });

  it('discards a failed publication when the circle has no previous files', async () => {
    fs.rename.callsFake(async (from, to) => {
      if (String(to).includes('previous-')) throw missing;
      if (
        String(from).endsWith('/variants') &&
        to === '/circle-images/walkers'
      ) {
        throw failure;
      }
    });
    await controller.create(
      {
        body: { label: 'Walkers', color: '1e3a8a' },
        file: { path: '/upload.png' },
      },
      res,
    );
    assert.strictEqual(res.statusCode, 400);
    sinon.assert.notCalled(circle.save);
  });

  const busy = Object.assign(new Error('busy'), { code: 'EEXIST' });

  it('waits while another update holds the image lock', async () => {
    fs.open.onCall(0).rejects(busy);
    fs.open.onCall(1).resolves(lockHandle);
    fs.stat.resolves({ mtimeMs: Date.now() });
    await controller.update(
      {
        params: { circle: 'circle-1' },
        body: { label: 'Walkers', color: '1e3a8a' },
        file: { path: '/upload.png' },
      },
      res,
    );
    assert.strictEqual(res.statusCode, 200);
    sinon.assert.calledTwice(fs.open);
  });

  it('replaces a stale image lock', async () => {
    fs.open.onCall(0).rejects(busy);
    fs.open.onCall(1).resolves(lockHandle);
    fs.stat.resolves({ mtimeMs: Date.now() - 130_000 });
    await controller.update(
      {
        params: { circle: 'circle-1' },
        body: { label: 'Walkers', color: '1e3a8a' },
        file: { path: '/upload.png' },
      },
      res,
    );
    assert.strictEqual(res.statusCode, 200);
    sinon.assert.calledWith(fs.rm, '/circle-images/.staging-lock-walkers', {
      recursive: true,
      force: true,
    });
  });

  it('retries when the image lock disappears while waiting', async () => {
    fs.open.onCall(0).rejects(busy);
    fs.open.onCall(1).resolves(lockHandle);
    fs.stat.rejects(missing);
    await controller.update(
      {
        params: { circle: 'circle-1' },
        body: { label: 'Walkers', color: '1e3a8a' },
        file: { path: '/upload.png' },
      },
      res,
    );
    assert.strictEqual(res.statusCode, 200);
    sinon.assert.calledTwice(fs.open);
  });

  it('reports an image-lock status failure', async () => {
    fs.open.rejects(busy);
    fs.stat.rejects(failure);
    await controller.update(
      {
        params: { circle: 'circle-1' },
        body: { label: 'Walkers', color: '1e3a8a' },
        file: { path: '/upload.png' },
      },
      res,
    );
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.message, failure.message);
    sinon.assert.notCalled(sharp);
  });

  it('reports a failure to create the image lock', async () => {
    fs.open.rejects(failure);
    await controller.update(
      {
        params: { circle: 'circle-1' },
        body: { label: 'Walkers', color: '1e3a8a' },
        file: { path: '/upload.png' },
      },
      res,
    );
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.message, failure.message);
    sinon.assert.notCalled(sharp);
  });

  it('stops waiting when an image update stays locked', async () => {
    const clock = sinon.useFakeTimers({ now: 1_000_000 });
    fs.open.rejects(busy);
    fs.stat.resolves({ mtimeMs: 1_000_000 });
    const pending = controller.update(
      {
        params: { circle: 'circle-1' },
        body: { label: 'Walkers', color: '1e3a8a' },
        file: { path: '/upload.png' },
      },
      res,
    );
    await clock.tickAsync(31_000);
    await pending;
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(
      res.body.message,
      'Another update of this circle image is in progress.',
    );
    sinon.assert.notCalled(sharp);
  });

  it('validates multipart images through the shared upload handler', () => {
    const req = { is: sinon.stub().returns(true) };
    const next = sinon.spy();
    controller.processImageUpload(req, res, next);
    sinon.assert.calledWith(req.is, 'multipart/form-data');
    sinon.assert.calledWith(
      uploadFile,
      ['image/gif', 'image/jpeg', 'image/jpg', 'image/png'],
      'image',
      req,
      res,
      next,
    );
  });
});
