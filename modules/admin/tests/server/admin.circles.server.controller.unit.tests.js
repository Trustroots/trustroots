const assert = require('assert');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

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
  let uploadFile;
  let circle;
  let query;
  let res;
  const failure = new Error('Storage unavailable');
  const missing = Object.assign(new Error('Missing'), { code: 'ENOENT' });

  beforeEach(() => {
    circle = { _id: 'circle-1', slug: 'walkers', image: false, public: false };
    circle.save = sinon.stub().resolves(circle);
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
    fs = {
      mkdir: sinon.stub().resolves(),
      rename: sinon.stub().resolves(),
      rm: sinon.stub().resolves(),
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
    controller = proxyquire(
      '../../server/controllers/admin.circles.server.controller',
      {
        mongoose: { model: () => Tribe },
        fs: { promises: fs },
        sharp,
        '../../../../config/config': { circleImagesDir: '/circle-images' },
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
      sinon.assert.calledTwice(circle.save);
      sinon.assert.calledWith(fs.mkdir, '/circle-images/walkers', {
        recursive: true,
      });
      sinon.assert.calledWith(
        fs.rename,
        sinon.match(/^\/circle-images\/walkers.jpg.tmp-/),
        '/circle-images/walkers.jpg',
      );
      for (const size of ['120x120', '742x496', '906x240', '1400x900']) {
        for (const ext of ['jpg', 'webp'])
          sinon.assert.calledWith(
            image.toFile,
            `/circle-images/walkers/${size}.${ext}`,
          );
      }
      sinon.assert.calledWith(image.rotate);
      sinon.assert.calledWith(fs.rm, '/upload.png', {
        recursive: true,
        force: true,
      });
    });
  }

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

  it('rolls back the new circle and assets after an image failure', async () => {
    image.toFile.rejects(failure);
    Tribe.findByIdAndDelete.rejects(failure);
    await controller.create({ body: {}, file: { path: '/upload.png' } }, res);
    assert.strictEqual(res.statusCode, 400);
    for (const file of [
      '/upload.png',
      '/circle-images/walkers.jpg',
      '/circle-images/walkers',
    ])
      sinon.assert.calledWith(fs.rm, file, { recursive: true, force: true });
    sinon.assert.calledWith(Tribe.findByIdAndDelete, 'circle-1');
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

  function renameFrom(oldSlug) {
    circle.image = true;
    circle.slug = oldSlug;
    circle.save.callsFake(async () => {
      circle.slug = 'renamed';
      return circle;
    });
  }

  it('moves image files when a circle is renamed', async () => {
    renameFrom('walkers');
    await controller.update({ params: {}, body: {} }, res);
    sinon.assert.calledWith(
      fs.rename,
      '/circle-images/walkers.jpg',
      '/circle-images/renamed.jpg',
    );
    sinon.assert.calledWith(
      fs.rename,
      '/circle-images/walkers',
      '/circle-images/renamed',
    );
  });

  it('does not move images when the slug is unchanged', async () => {
    circle.image = true;
    await controller.update({ params: {}, body: {} }, res);
    sinon.assert.notCalled(fs.rename);
  });

  it('tolerates a missing previous slug', async () => {
    renameFrom(undefined);
    await controller.update({ params: {}, body: {} }, res);
    sinon.assert.notCalled(fs.rename);
  });

  it('tolerates missing image assets when renaming', async () => {
    renameFrom('walkers');
    fs.rename.rejects(missing);
    await controller.update({ params: {}, body: {} }, res);
    assert.strictEqual(res.statusCode, 200);
    sinon.assert.calledTwice(fs.rename);
  });

  for (const index of [0, 1]) {
    it(`reports rename errors for asset ${index}`, async () => {
      renameFrom('walkers');
      fs.rename.onCall(index).rejects(failure);
      await controller.update({ params: {}, body: {} }, res);
      assert.strictEqual(res.statusCode, 400);
    });
  }

  it('passes JSON requests through the upload middleware', () => {
    const next = sinon.spy();
    controller.processImageUpload({ is: () => false }, res, next);
    sinon.assert.calledOnce(next);
    sinon.assert.notCalled(uploadFile);
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
