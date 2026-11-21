import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import sinon, { type SinonStub } from 'sinon';
import multerImport from 'multer';
import config from './../../../../../config/config.mts';
import * as uploadService from './../../../server/services/file-upload.service.mts';
import errorService from './../../../server/services/error.server.service.mts';
import 'should';
import express from 'express';
import request from 'supertest';

/**
 * Unit tests for the file upload service.
 */

type UploadedFile = { path: string; size?: number; mimetype?: string };
type UploadRequest = { file?: UploadedFile; [key: string]: unknown };
type MockResponse = {
  statusCode: number;
  body: { message?: string; size?: number } | null;
  status(code: number): MockResponse;
  send(body?: { message?: string; size?: number }): MockResponse | void;
};
type UploadError = Error | { code?: string };
type UploadCallback = (error?: UploadError | null) => void;
type UploadMiddleware = (
  req: UploadRequest,
  res: MockResponse,
  callback: UploadCallback,
) => void;
type MulterOptions = {
  fileFilter: (
    req: UploadRequest,
    file: UploadedFile,
    callback: (error?: Error | null, accept?: boolean) => void,
  ) => void;
  storage: {
    getDestination: (
      req: unknown,
      file: unknown,
      callback: (error: Error | null, destination: string) => void,
    ) => void;
  };
  limits: { fileSize: number; files: number; fields: number; parts: number };
};
const multer = multerImport as unknown as {
  (): { single(field: string): UploadMiddleware };
  prototype: object;
};
const multerPrototype = Object.getPrototypeOf(multer());
let singleStub: SinonStub;

const temporaryUploadDirectories: string[] = [];

function createTempDirectory(
  prefix = path.join(os.tmpdir(), 'trustroots-upload-test-'),
): string {
  const directory = fs.mkdtempSync(prefix);
  temporaryUploadDirectories.push(directory);
  return directory;
}

function writeTempFile(
  buffer: Buffer,
  directory = config.uploadTmpDir,
): string {
  const filePath = path.join(directory, randomBytes(16).toString('hex'));
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

function mockResponse(done?: () => void): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    send(body?: { message?: string; size?: number }) {
      res.body = body ?? null;
      if (done) {
        done();
      }
      return res;
    },
  };
  return res;
}

function loadUploadFileWithStubbedMulter(
  reqFile: UploadedFile | null,
  multerError?: UploadError,
): typeof uploadService.uploadFile {
  singleStub.callsFake(
    () =>
      ((req: UploadRequest, _res: MockResponse, callback: UploadCallback) => {
        if (multerError) return callback(multerError);
        if (reqFile) req.file = reqFile;
        callback(null);
      }) as UploadMiddleware,
  );
  return uploadService.uploadFile;
}

function loadUploadFileWithFileFilter(
  file: Partial<UploadedFile>,
  reqFile: UploadedFile,
  configOverrides: Partial<typeof config> = {},
) {
  let capturedMulterOptions: MulterOptions | undefined;
  Object.assign(config, configOverrides);
  singleStub.callsFake(function (this: MulterOptions) {
    capturedMulterOptions = this as MulterOptions;
    const options = this as MulterOptions;
    return ((
      req: UploadRequest,
      _res: MockResponse,
      callback: UploadCallback,
    ) => {
      options.fileFilter(
        req,
        file as UploadedFile,
        (err?: UploadError | null) => {
          if (err) return callback(err);
          req.file = reqFile;
          callback(null);
        },
      );
    }) as UploadMiddleware;
  });
  return {
    getMulterOptions: () => capturedMulterOptions,
    uploadFile: uploadService.uploadFile,
  };
}

describe('file-upload.service unit tests', () => {
  const validMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
  ];
  const uploadField = 'avatar';

  let originalFallback: string | undefined;
  let originalConfig: Record<string, unknown>;

  beforeEach(() => {
    singleStub = sinon.stub(multerPrototype, 'single');
    originalFallback = process.env.TRUSTROOTS_FILE_MAGIC_FALLBACK;
    originalConfig = { ...config };
    process.env.TRUSTROOTS_FILE_MAGIC_FALLBACK = 'true';
    config.uploadTmpDir = createTempDirectory();
  });

  afterEach(() => {
    temporaryUploadDirectories
      .splice(0)
      .forEach(directory =>
        fs.rmSync(directory, { recursive: true, force: true }),
      );
    sinon.restore();
    Object.keys(config).forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(originalConfig, key)) {
        Reflect.deleteProperty(config, key);
      }
    });
    Object.assign(config, originalConfig);
    if (originalFallback === undefined) {
      delete process.env.TRUSTROOTS_FILE_MAGIC_FALLBACK;
    } else {
      process.env.TRUSTROOTS_FILE_MAGIC_FALLBACK = originalFallback;
    }
  });

  it('maps unsupported media type errors from multer', done => {
    const uploadFile = loadUploadFileWithStubbedMulter(null, {
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
    const res = mockResponse(() => {
      res.statusCode.should.equal(415);
      res.body!.message!.should.equal(
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
      res.body!.message!.should.containEql('Image too big');
      done();
    });

    uploadFile(validMimeTypes, uploadField, {}, res, () => {});
  });

  it('accepts a file above the general limit using the larger avatar limit', async () => {
    singleStub.restore();

    const app = express();
    const photo = Buffer.alloc(11 * 1024 * 1024);
    Buffer.from([0xff, 0xd8, 0xff]).copy(photo);
    config.maxUploadSize = 10 * 1024 * 1024;
    app.post('/photo', ((
      req: { file: UploadedFile },
      res: import('express').Response,
    ) => {
      uploadService.uploadFile(
        validMimeTypes,
        'avatar',
        req,
        res,
        () => {
          res.send({ size: req.file.size });
        },
        20 * 1024 * 1024,
      );
    }) as never);
    const response = await request(app)
      .post('/photo')
      .attach('avatar', photo, {
        filename: 'camera-photo.jpg',
        contentType: 'image/jpeg',
      })
      .expect(200);
    response.body.size.should.equal(photo.length);
  });

  it('maps generic multer errors to the default message', done => {
    const uploadFile = loadUploadFileWithStubbedMulter(null, {
      code: 'UNKNOWN_ERROR',
    });
    const res = mockResponse(() => {
      res.statusCode.should.equal(400);
      res.body!.message!.should.equal(
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
      res.body!.message!.should.equal(
        'Missing "avatar" field from the API call.',
      );
      done();
    });

    uploadFile(validMimeTypes, uploadField, {}, res, () => {});
  });

  it('rejects multer files without a mime type before magic-byte validation', done => {
    const { uploadFile } = loadUploadFileWithFileFilter(
      {},
      { path: '/tmp/not-used' },
    );
    const res = mockResponse(() => {
      res.statusCode.should.equal(415);
      res.body!.message!.should.equal(
        errorService.getErrorMessageByKey('unsupported-media-type'),
      );
      done();
    });

    uploadFile(validMimeTypes, uploadField, {}, res, () => {});
  });

  it('accepts multer files with supported mime types before magic-byte validation', done => {
    const filePath = writeTempFile(Buffer.from([0xff, 0xd8, 0xff, 0x00]));
    const { getMulterOptions, uploadFile } = loadUploadFileWithFileFilter(
      { mimetype: 'image/jpeg' },
      { path: filePath },
      {
        uploadTmpDir: '',
      },
    );

    uploadFile(validMimeTypes, uploadField, {}, mockResponse(), () => {
      try {
        const options = getMulterOptions()!;
        options.storage.getDestination({}, {}, (err, destination) => {
          if (err) throw err;
          destination.should.equal(os.tmpdir());
        });
        options.limits.fileSize.should.be.a.Number();
        options.limits.files.should.equal(1);
        options.limits.fields.should.equal(10);
        options.limits.parts.should.equal(11);
        done();
      } catch (err) {
        done(err);
      }
    });
  });

  const validationCases: Array<[string, Buffer, number]> = [
    ['a valid image', Buffer.from([0xff, 0xd8, 0xff, 0x00]), 200],
    ['disguised non-image content', Buffer.from('not an image'), 415],
  ];
  for (const [description, bytes, expectedStatus] of validationCases) {
    it(`validates ${description} by its bytes when the browser omits the MIME type`, done => {
      const filePath = writeTempFile(bytes);
      const { uploadFile } = loadUploadFileWithFileFilter(
        { mimetype: 'application/octet-stream' },
        { path: filePath },
      );
      const res = mockResponse();
      const finish = () => {
        try {
          res.statusCode.should.equal(expectedStatus);
          done();
        } catch (err) {
          done(err);
        }
      };
      res.send = finish;
      uploadFile(validMimeTypes, uploadField, {}, res, finish);
    });
  }

  it('removes temporary files after content validation declines an upload', done => {
    const filePath = writeTempFile(Buffer.from('Sample text document'));
    const uploadFile = loadUploadFileWithStubbedMulter({ path: filePath });
    const res = mockResponse(() => {
      res.statusCode.should.equal(415);
      res.body!.message!.should.equal(
        errorService.getErrorMessageByKey('unsupported-media-type'),
      );
      fs.existsSync(filePath).should.equal(false);
      done();
    });
    uploadFile(validMimeTypes, uploadField, {}, res, () =>
      done(new Error('Unexpected accepted file')),
    );
  });

  it('rejects requests without an uploaded file', done => {
    const uploadFile = loadUploadFileWithStubbedMulter(null);
    const res = mockResponse(() => {
      res.statusCode.should.equal(422);
      res.body!.message!.should.equal(
        errorService.getErrorMessageByKey('unprocessable-entity'),
      );
      done();
    });

    uploadFile(validMimeTypes, uploadField, {}, res, () => {});
  });

  it('leaves files outside the upload directory untouched', done => {
    const sibling = createTempDirectory(`${config.uploadTmpDir}-sibling-`);
    const filePath = writeTempFile(
      Buffer.from('Sample text document'),
      sibling,
    );
    const uploadFile = loadUploadFileWithStubbedMulter({ path: filePath });
    const res = mockResponse(() => {
      res.statusCode.should.equal(422);
      res.body!.message!.should.equal(
        errorService.getErrorMessageByKey('unprocessable-entity'),
      );
      fs.existsSync(filePath).should.equal(true);
      done();
    });

    uploadFile(validMimeTypes, uploadField, {}, res, () =>
      done(new Error('Unexpected accepted file')),
    );
  });

  it('rejects the configured directory itself as an upload', done => {
    config.uploadTmpDir = path.parse(config.uploadTmpDir).root;
    const uploadFile = loadUploadFileWithStubbedMulter({
      path: config.uploadTmpDir,
    });
    const res = mockResponse(() => {
      res.statusCode.should.equal(422);
      res.body!.message!.should.equal(
        errorService.getErrorMessageByKey('unprocessable-entity'),
      );
      done();
    });

    uploadFile(validMimeTypes, uploadField, {}, res, () =>
      done(new Error('Unexpected accepted directory')),
    );
  });

  it('accepts or rejects files by their detected content', async () => {
    const cases: Array<[string, Buffer, boolean, number]> = [
      // [label, bytes, use the fallback detector, expected status]
      ['jpeg', Buffer.from([0xff, 0xd8, 0xff, 0x00]), true, 200],
      ['png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]), true, 200],
      ['gif', Buffer.from('GIF89a'), true, 200],
      ['pdf', Buffer.from('%PDF-1.4'), true, 200],
      [
        'svg',
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
        true,
        415,
      ],
      [
        'file-type jpeg',
        Buffer.from([
          0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
        ]),
        false,
        200,
      ],
      ['file-type unknown', Buffer.from('not a supported file'), false, 415],
    ];
    for (const [label, bytes, fallback, status] of cases) {
      if (fallback) process.env.TRUSTROOTS_FILE_MAGIC_FALLBACK = 'true';
      else delete process.env.TRUSTROOTS_FILE_MAGIC_FALLBACK;
      (await detectedStatus(bytes, validMimeTypes)).should.equal(status, label);
    }
  });

  it('rejects files when fallback detection cannot read the file', done => {
    const uploadFile = loadUploadFileWithStubbedMulter({
      path: path.join(config.uploadTmpDir, 'missing-upload-file'),
    });
    const res = mockResponse(() => {
      res.statusCode.should.equal(415);
      done();
    });

    uploadFile(validMimeTypes, uploadField, {}, res, () => {});
  });

  function detectedStatus(bytes: Buffer, allowed: string[]): Promise<number> {
    const filePath = writeTempFile(bytes);
    const uploadFile = loadUploadFileWithStubbedMulter({ path: filePath });
    return new Promise(resolve => {
      const res = mockResponse(() => resolve(res.statusCode));
      uploadFile(allowed, uploadField, {}, res, () => resolve(200));
    });
  }

  const webp = Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    Buffer.from([0x24, 0, 0, 0]),
    Buffer.from('WEBPVP8 ', 'ascii'),
    Buffer.alloc(32),
  ]);

  it('only treats the full JPEG and PNG signatures as images', async () => {
    for (const bytes of [
      [0xff, 0xd8, 0x00, 0x00],
      [0xff, 0x00, 0xff, 0x00],
      [0x00, 0xd8, 0xff, 0x00],
      [0x00, 0x00, 0xff, 0x00],
    ]) {
      (await detectedStatus(Buffer.from(bytes), ['image/jpeg'])).should.equal(
        415,
      );
    }
    (
      await detectedStatus(Buffer.from([0x89, 0x50, 0x4e, 0x58]), ['image/png'])
    ).should.equal(415);
    (
      await detectedStatus(Buffer.from('\x00PNG', 'latin1'), ['image/png'])
    ).should.equal(415);
  });

  it('recognises SVG documents with or without an XML declaration', async () => {
    const svg = ['image/svg+xml'];
    for (const text of [
      '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      '  \n<svg></svg>',
      '<?xml version="1.0"?>\n<svg></svg>',
      '<?xml?><svg></svg>',
    ]) {
      (await detectedStatus(Buffer.from(text, 'utf8'), svg)).should.equal(
        200,
        text,
      );
    }
    for (const text of [
      'Sample text document',
      'Notes about <svg> files',
      'Notes <?xml?><svg></svg>',
    ]) {
      (await detectedStatus(Buffer.from(text, 'utf8'), svg)).should.equal(
        415,
        text,
      );
    }
  });

  it('reports unrecognised content as a generic binary', async () => {
    (
      await detectedStatus(Buffer.from('Sample text document'), [
        'application/octet-stream',
      ])
    ).should.equal(200);
  });

  it('uses the file-type detector unless the fallback is requested', async () => {
    delete process.env.TRUSTROOTS_FILE_MAGIC_FALLBACK;
    (await detectedStatus(webp, ['image/webp'])).should.equal(200);
    process.env.TRUSTROOTS_FILE_MAGIC_FALLBACK = 'false';
    (await detectedStatus(webp, ['image/webp'])).should.equal(200);
    process.env.TRUSTROOTS_FILE_MAGIC_FALLBACK = 'true';
    (await detectedStatus(webp, ['image/webp'])).should.equal(415);
  });

  it('falls back to its own detector for content file-type does not know', async () => {
    delete process.env.TRUSTROOTS_FILE_MAGIC_FALLBACK;
    (
      await detectedStatus(Buffer.from('<svg></svg>', 'utf8'), [
        'image/svg+xml',
      ])
    ).should.equal(200);
  });

  it('rejects declared MIME types outside the allowed list even when the bytes are an image', done => {
    const { uploadFile } = loadUploadFileWithFileFilter(
      { mimetype: 'text/plain' },
      { path: writeTempFile(Buffer.from([0xff, 0xd8, 0xff, 0x00])) },
    );
    const res = mockResponse(() => {
      res.statusCode.should.equal(415);
      res.body!.message!.should.equal(
        errorService.getErrorMessageByKey('unsupported-media-type'),
      );
      done();
    });
    uploadFile(validMimeTypes, uploadField, {}, res, () =>
      done(new Error('Unexpected accepted file')),
    );
  });
});
