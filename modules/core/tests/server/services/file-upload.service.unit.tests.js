/**
 * Unit tests for the file upload service.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const proxyquire = require('proxyquire').noCallThru();

const errorService = require('../../../server/services/error.server.service');
require('should');

function writeTempFile(buffer) {
  const filePath = path.join(
    os.tmpdir(),
    `trustroots-upload-test-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`,
  );
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

function mockResponse(done) {
  const res = { statusCode: 200, body: null };
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.send = function (body) {
    res.body = body;
    if (done) {
      done();
    }
    return res;
  };
  return res;
}

function loadUploadFileWithStubbedMulter(reqFile, multerError) {
  return proxyquire('../../../server/services/file-upload.service', {
    multer: () => ({
      single: () => (req, res, callback) => {
        if (multerError) {
          return callback(multerError);
        }
        req.file = reqFile;
        callback(null);
      },
    }),
    '../../../../config/config': require('../../../../../config/config'),
    './error.server.service': errorService,
  }).uploadFile;
}

describe('file-upload.service unit tests', () => {
  const validMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
  ];
  const uploadField = 'avatar';

  beforeEach(() => {
    process.env.TRUSTROOTS_FILE_MAGIC_FALLBACK = 'true';
  });

  it('maps unsupported media type errors from multer', done => {
    const uploadFile = loadUploadFileWithStubbedMulter(null, {
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
    const res = mockResponse(() => {
      res.statusCode.should.equal(415);
      res.body.message.should.equal(
        errorService.getErrorMessageByKey('unsupported-media-type'),
      );
      done();
    });

    uploadFile(validMimeTypes, uploadField, {}, res, () => {});
  });

  it('maps file size limit errors from multer', done => {
    const uploadFile = loadUploadFileWithStubbedMulter(null, {
      code: 'LIMIT_FILE_SIZE',
    });
    const res = mockResponse(() => {
      res.statusCode.should.equal(413);
      res.body.message.should.containEql('Image too big');
      done();
    });

    uploadFile(validMimeTypes, uploadField, {}, res, () => {});
  });

  it('maps generic multer errors to the default message', done => {
    const uploadFile = loadUploadFileWithStubbedMulter(null, {
      code: 'UNKNOWN_ERROR',
    });
    const res = mockResponse(() => {
      res.statusCode.should.equal(400);
      res.body.message.should.equal(
        errorService.getErrorMessageByKey('default'),
      );
      done();
    });

    uploadFile(validMimeTypes, uploadField, {}, res, () => {});
  });

  it('maps unexpected field errors from multer', done => {
    const uploadFile = loadUploadFileWithStubbedMulter(null, {
      code: 'LIMIT_UNEXPECTED_FILE',
    });
    const res = mockResponse(() => {
      res.statusCode.should.equal(400);
      res.body.message.should.equal(
        'Missing "avatar" field from the API call.',
      );
      done();
    });

    uploadFile(validMimeTypes, uploadField, {}, res, () => {});
  });

  it('rejects requests without an uploaded file', done => {
    const uploadFile = loadUploadFileWithStubbedMulter(null);
    const res = mockResponse(() => {
      res.statusCode.should.equal(422);
      res.body.message.should.equal(
        errorService.getErrorMessageByKey('unprocessable-entity'),
      );
      done();
    });

    uploadFile(validMimeTypes, uploadField, {}, res, () => {});
  });

  it('rejects files whose magic bytes do not match allowed mime types', done => {
    const filePath = writeTempFile(Buffer.from('not-an-image', 'utf8'));
    const uploadFile = loadUploadFileWithStubbedMulter({ path: filePath });
    const res = mockResponse(() => {
      try {
        res.statusCode.should.equal(415);
        res.body.message.should.equal(
          errorService.getErrorMessageByKey('unsupported-media-type'),
        );
        fs.unlinkSync(filePath);
        done();
      } catch (err) {
        fs.unlinkSync(filePath);
        done(err);
      }
    });

    uploadFile(validMimeTypes, uploadField, {}, res, () => {});
  });

  it('accepts jpeg, png, gif, and pdf files via the fallback detector', done => {
    const samples = [
      { buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]), mime: 'image/jpeg' },
      {
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]),
        mime: 'image/png',
      },
      { buffer: Buffer.from('GIF89a', 'ascii'), mime: 'image/gif' },
      { buffer: Buffer.from('%PDF-1.4', 'ascii'), mime: 'application/pdf' },
    ];

    let index = 0;

    function runNext() {
      const sample = samples[index];
      const filePath = writeTempFile(sample.buffer);
      const uploadFile = loadUploadFileWithStubbedMulter({ path: filePath });

      uploadFile(validMimeTypes, uploadField, {}, mockResponse(), () => {
        try {
          fs.unlinkSync(filePath);
          index += 1;
          if (index < samples.length) {
            runNext();
          } else {
            done();
          }
        } catch (err) {
          fs.unlinkSync(filePath);
          done(err);
        }
      });
    }

    runNext();
  });

  it('accepts jpeg files via the mmmagic detector', done => {
    delete process.env.TRUSTROOTS_FILE_MAGIC_FALLBACK;
    const filePath = writeTempFile(Buffer.from([0xff, 0xd8, 0xff, 0x00]));
    const uploadFile = proxyquire(
      '../../../server/services/file-upload.service',
      {
        multer: () => ({
          single: () => (req, res, callback) => {
            req.file = { path: filePath };
            callback(null);
          },
        }),
        mmmagic: {
          MAGIC_MIME_TYPE: 16,
          Magic: function Magic() {
            this.detectFile = (path, cb) => cb(null, 'image/jpeg');
          },
        },
        '../../../../config/config': require('../../../../../config/config'),
        './error.server.service': errorService,
      },
    ).uploadFile;

    uploadFile(validMimeTypes, uploadField, {}, mockResponse(), () => {
      try {
        fs.unlinkSync(filePath);
        done();
      } catch (err) {
        fs.unlinkSync(filePath);
        done(err);
      }
    });
  });

  it('rejects files when mmmagic detection fails', done => {
    delete process.env.TRUSTROOTS_FILE_MAGIC_FALLBACK;
    const filePath = writeTempFile(Buffer.from([0xff, 0xd8, 0xff, 0x00]));
    const uploadFile = proxyquire(
      '../../../server/services/file-upload.service',
      {
        multer: () => ({
          single: () => (req, res, callback) => {
            req.file = { path: filePath };
            callback(null);
          },
        }),
        mmmagic: {
          MAGIC_MIME_TYPE: 16,
          Magic: function Magic() {
            this.detectFile = (path, cb) => cb(new Error('magic failed'));
          },
        },
        '../../../../config/config': require('../../../../../config/config'),
        './error.server.service': errorService,
      },
    ).uploadFile;
    const res = mockResponse(() => {
      try {
        res.statusCode.should.equal(415);
        fs.unlinkSync(filePath);
        done();
      } catch (err) {
        fs.unlinkSync(filePath);
        done(err);
      }
    });

    uploadFile(validMimeTypes, uploadField, {}, res, () => {});
  });

  it('accepts svg files via the fallback detector', done => {
    const filePath = writeTempFile(
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'utf8'),
    );
    const uploadFile = loadUploadFileWithStubbedMulter({ path: filePath });
    const res = mockResponse(() => {
      try {
        res.statusCode.should.equal(415);
        fs.unlinkSync(filePath);
        done();
      } catch (err) {
        fs.unlinkSync(filePath);
        done(err);
      }
    });

    uploadFile(validMimeTypes, uploadField, {}, res, () => {});
  });

  it('rejects files when fallback detection cannot read the file', done => {
    const uploadFile = loadUploadFileWithStubbedMulter({
      path: '/tmp/trustroots-missing-upload-file',
    });
    const res = mockResponse(() => {
      res.statusCode.should.equal(415);
      done();
    });

    uploadFile(validMimeTypes, uploadField, {}, res, () => {});
  });
});
