import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import sinon from 'sinon';
import config from './../../../../../config/config.mts';
import {
  readUpload,
  uploadFile,
  type UploadedFile,
} from './../../../server/services/file-upload.service.mts';
import errorService from './../../../server/services/error.server.service.mts';
import 'should';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const validMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];

type Part = {
  name: string;
  content?: Buffer | string;
  filename?: string;
  type?: string;
};
type TestRequest = Readable & {
  headers: Record<string, string>;
  body?: Record<string, unknown>;
  file?: Partial<UploadedFile>;
};

function multipart(parts: Part[], extraHeaders = {}): TestRequest {
  const boundary = '----fictional-boundary';
  const chunks: Buffer[] = [];
  for (const { name, content = '', filename, type } of parts) {
    const disposition = `form-data; name="${name}"${
      filename === undefined ? '' : `; filename="${filename}"`
    }`;
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: ${disposition}\r\n${
          type ? `Content-Type: ${type}\r\n` : ''
        }\r\n`,
      ),
      Buffer.from(content),
      Buffer.from('\r\n'),
    );
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  const body = Buffer.concat(chunks);
  return Object.assign(Readable.from(chunks), {
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'content-length': String(body.length),
      ...extraHeaders,
    },
  });
}
const image = (content: Buffer, type = 'image/png', name = 'avatar') => ({
  name,
  content,
  filename: 'photo.png',
  type,
});

function run(
  req: TestRequest,
  maxUploadSize?: number,
  field = 'avatar',
  allowedTypes = validMimeTypes,
) {
  return new Promise<{
    status?: number;
    message?: string;
    passed: boolean;
  }>(resolve => {
    const res = {
      status(code: number) {
        return {
          send(body: { message: string }) {
            resolve({ status: code, message: body.message, passed: false });
          },
        };
      },
    };
    uploadFile(
      allowedTypes,
      field,
      req,
      res,
      () => resolve({ passed: true }),
      maxUploadSize,
    );
  });
}

describe('file-upload.service unit tests', () => {
  let uploadDirectory: string;
  let originalTmpDir: unknown;
  let originalFallback: string | undefined;

  beforeEach(() => {
    uploadDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'trustroots-upload-test-'),
    );
    originalTmpDir = config.uploadTmpDir;
    config.uploadTmpDir = uploadDirectory;
    originalFallback = process.env.TRUSTROOTS_FILE_MAGIC_FALLBACK;
    delete process.env.TRUSTROOTS_FILE_MAGIC_FALLBACK;
  });

  afterEach(() => {
    sinon.restore();
    fs.rmSync(uploadDirectory, { recursive: true, force: true });
    config.uploadTmpDir = originalTmpDir as string;
    if (originalFallback === undefined) {
      delete process.env.TRUSTROOTS_FILE_MAGIC_FALLBACK;
    } else {
      process.env.TRUSTROOTS_FILE_MAGIC_FALLBACK = originalFallback;
    }
  });

  describe('readUpload', () => {
    it('returns the uploaded file with its name and declared type', async () => {
      const req = multipart([{ name: 'note', content: 'hello' }, image(png)]);
      const { file, fields } = (await readUpload(req, 'avatar', 1024))!;
      assert.deepEqual(fields, { note: 'hello' });
      file.buffer.equals(png).should.be.true();
      file.mimetype.should.equal('image/png');
      file.originalname.should.equal('photo.png');
    });

    it('recognises multipart content types regardless of their casing', async () => {
      const req = multipart([image(png)]);
      req.headers['content-type'] = req.headers['content-type']!.replace(
        'multipart/form-data',
        'Multipart/Form-Data ',
      );
      const file = await readUpload(req, 'avatar', 1024);
      file!.file.buffer.equals(png).should.be.true();
    });

    it('resolves to undefined when the request has no file', async () => {
      const result = await readUpload(
        multipart([{ name: 'note', content: 'hello' }]),
        'avatar',
        1024,
      );
      (result === undefined).should.be.true();
    });

    it('treats an unselected file input as no upload', async () => {
      const result = await readUpload(
        multipart([
          { name: 'avatar', filename: '', type: 'application/octet-stream' },
        ]),
        'avatar',
        1024,
      );
      (result === undefined).should.be.true();
    });

    it('accepts a file of exactly the maximum size', async () => {
      const file = await readUpload(
        multipart([image(Buffer.alloc(100, 1))]),
        'avatar',
        100,
      );
      file!.file.buffer.length.should.equal(100);
    });

    it('rejects a file one byte over the maximum', async () => {
      await readUpload(
        multipart([image(Buffer.alloc(101, 1))]),
        'avatar',
        100,
      ).should.be.rejectedWith({ code: 'LIMIT_FILE_SIZE' });
    });

    it('rejects a declared length far over the maximum without reading it', async () => {
      const req = multipart([image(png)], { 'content-length': '999999999' });
      await readUpload(req, 'avatar', 100).should.be.rejectedWith({
        code: 'LIMIT_FILE_SIZE',
      });
      (req.readableFlowing === null).should.be.true();
    });

    it('rejects oversized form fields even when the file and declared length fit', async () => {
      const req = multipart(
        [image(png), { name: 'note', content: 'a'.repeat(200 * 1024) }],
        { 'content-length': '10' },
      );
      await readUpload(req, 'avatar', 100).should.be.rejectedWith({
        code: 'LIMIT_FILE_SIZE',
      });
    });

    it('accepts a request of exactly the total multipart limit', async () => {
      const fileLimit = 100;
      const unpadded = multipart([image(png), { name: 'note' }]);
      const padding =
        64 * 1024 + fileLimit - Number(unpadded.headers['content-length']);
      const req = multipart([
        image(png),
        { name: 'note', content: 'a'.repeat(padding) },
      ]);
      assert.deepEqual(
        (await readUpload(req, 'avatar', fileLimit))?.file.buffer,
        png,
      );
    });

    it('rejects files in unexpected fields and more than one file', async () => {
      await readUpload(
        multipart([image(png, 'image/png', 'other')]),
        'avatar',
        1024,
      ).should.be.rejectedWith({ code: 'LIMIT_UNEXPECTED_FILE' });
      await readUpload(
        multipart([image(png), image(png)]),
        'avatar',
        1024,
      ).should.be.rejectedWith({ code: 'LIMIT_UNEXPECTED_FILE' });
    });

    it('rejects more parts than the limit', async () => {
      const fields = Array.from({ length: 11 }, (_, index) => ({
        name: `field${index}`,
        content: 'x',
      }));
      await readUpload(
        multipart([...fields, image(png)]),
        'avatar',
        1024,
      ).should.be.rejectedWith({ code: 'LIMIT_UNEXPECTED_FILE' });
      const result = await readUpload(
        multipart([...fields.slice(1), image(png)]),
        'avatar',
        1024,
      );
      result!.file.buffer.equals(png).should.be.true();
    });

    it('resolves to undefined for requests that are not multipart', async () => {
      for (const headers of [
        { 'content-type': 'application/json' },
        { 'content-type': 'multipart/form-datax; boundary=ignored' },
        { 'content-type': 'text/multipart/form-data; boundary=ignored' },
        {},
      ]) {
        const req = Object.assign(Readable.from(['{}']), { headers });
        const result = await readUpload(req, 'avatar', 1024);
        (result === undefined).should.be.true();
      }
    });

    it('rejects multipart bodies that cannot be parsed', async () => {
      for (const contentType of [
        'multipart/form-data; boundary=missing',
        'multipart/form-data',
      ]) {
        const req = Object.assign(Readable.from([Buffer.from('broken')]), {
          headers: { 'content-type': contentType },
        });
        await readUpload(req, 'avatar', 1024).should.be.rejectedWith({
          code: 'INVALID_MULTIPART',
        });
      }
    });

    it('reports malformed multipart data at the total size limit as invalid', async () => {
      const fileLimit = 100;
      const req = Object.assign(
        Readable.from([Buffer.alloc(64 * 1024 + fileLimit)]),
        {
          headers: { 'content-type': 'multipart/form-data; boundary=missing' },
        },
      );
      await readUpload(req, 'avatar', fileLimit).should.be.rejectedWith({
        code: 'INVALID_MULTIPART',
      });
    });
  });

  describe('uploadFile', () => {
    it('passes multipart fields and the validated image to the next handler', async () => {
      const req = multipart([
        { name: 'label', content: 'Example circle' },
        image(png, 'image/png', 'image'),
        { name: 'organiserIds', content: '["example-one"]' },
      ]);
      const result = await run(req, undefined, 'image');
      result.passed.should.be.true();
      assert.deepEqual(
        { ...req.body },
        {
          label: 'Example circle',
          organiserIds: '["example-one"]',
        },
      );
      const stored = req.file!.path!;
      path.dirname(stored).should.equal(path.resolve(uploadDirectory));
      path.basename(stored).should.match(/^[a-f0-9]{32}$/);
      fs.readFileSync(stored).equals(png).should.be.true();
      (fs.statSync(stored).mode & 0o777).should.equal(0o600);
    });

    it('exposes the text fields of the form as req.body, like multer did', async () => {
      const req = multipart([
        { name: 'label', content: 'Hosts' },
        { name: 'public', content: 'true' },
        image(png),
      ]);
      await run(req);
      assert.deepEqual({ ...req.body }, { label: 'Hosts', public: 'true' });
    });

    it('falls back to the system temp directory without a configured one', async () => {
      config.uploadTmpDir = '';
      const req = multipart([image(png)]);
      await run(req);
      path.dirname(req.file!.path!).should.equal(os.tmpdir());
      fs.rmSync(req.file!.path!);
    });

    it('lets the bytes decide when the browser sends no or a generic type', async () => {
      for (const type of ['application/octet-stream', undefined]) {
        const req = multipart([image(jpeg, type as string)]);
        const result = await run(req);
        result.passed.should.be.true(String(type));
      }
    });

    it('uses its own detector on request and for content file-type does not know', async () => {
      process.env.TRUSTROOTS_FILE_MAGIC_FALLBACK = 'true';
      for (const content of [png, jpeg, Buffer.from('GIF89a')]) {
        (
          await run(multipart([image(content, 'image/png')]))
        ).passed.should.be.true();
      }
      delete process.env.TRUSTROOTS_FILE_MAGIC_FALLBACK;
      (
        await run(multipart([image(Buffer.from('GIF89a'), 'image/gif')]))
      ).passed.should.be.true();
    });

    it('recognises only the full JPEG and PNG signatures as images', async () => {
      process.env.TRUSTROOTS_FILE_MAGIC_FALLBACK = 'true';
      for (const content of [
        Buffer.from([0x00, 0xd8, 0xff]),
        Buffer.from([0xff, 0x00, 0xff]),
        Buffer.from([0xff, 0xd8, 0x00]),
        Buffer.from([0x00, 0x50, 0x4e, 0x47]),
        Buffer.from([0x89, 0x41, 0x42, 0x43]),
      ]) {
        (await run(multipart([image(content)]))).status!.should.equal(415);
      }
    });

    it('matches each fallback MIME signature against the caller’s exact allowlist', async () => {
      process.env.TRUSTROOTS_FILE_MAGIC_FALLBACK = 'true';
      for (const [text, mime] of [
        ['%PDF-1.4', 'application/pdf'],
        ['  <?xml version="1.0"?>\n<SVG></SVG>', 'image/svg+xml'],
        ['  <svg></svg>', 'image/svg+xml'],
        ['x<?xml version="1.0"?><svg></svg>', 'application/octet-stream'],
        ['text <svg></svg>', 'application/octet-stream'],
        ['plain text', 'application/octet-stream'],
      ] as const) {
        const req = multipart([image(Buffer.from(text), mime)]);
        (await run(req, undefined, 'avatar', [mime])).passed.should.be.true(
          text,
        );
      }
    });

    it('uses the requested detector for types that only file-type recognises', async () => {
      const webp = Buffer.from('RIFF0000WEBPVP8 ');
      const type = 'application/octet-stream';
      process.env.TRUSTROOTS_FILE_MAGIC_FALLBACK = 'true';
      const fallback = await run(
        multipart([image(webp, type)]),
        undefined,
        'avatar',
        [type],
      );
      fallback.passed.should.be.true();

      process.env.TRUSTROOTS_FILE_MAGIC_FALLBACK = 'false';
      const native = await run(
        multipart([image(webp, type)]),
        undefined,
        'avatar',
        [type],
      );
      native.status!.should.equal(415);
    });

    it('rejects declared types outside the list even when the bytes are an image', async () => {
      const result = await run(multipart([image(png, 'image/webp')]));
      result.status!.should.equal(415);
      result.message!.should.equal(
        errorService.getErrorMessageByKey('unsupported-media-type'),
      );
      fs.readdirSync(uploadDirectory).should.be.empty();
    });

    it('rejects content that is not an accepted image whatever its declared type', async () => {
      process.env.TRUSTROOTS_FILE_MAGIC_FALLBACK = 'true';
      for (const content of [
        Buffer.from('%PDF-1.4'),
        Buffer.from('<?xml version="1.0"?><svg></svg>'),
        Buffer.from('<svg></svg>'),
        Buffer.from('plain text'),
      ]) {
        (await run(multipart([image(content)]))).status!.should.equal(415);
      }
      delete process.env.TRUSTROOTS_FILE_MAGIC_FALLBACK;
      (
        await run(multipart([image(Buffer.from('plain text'), 'image/png')]))
      ).status!.should.equal(415);
      fs.readdirSync(uploadDirectory).should.be.empty();
    });

    it('answers 422 when no file was sent', async () => {
      const result = await run(multipart([{ name: 'note', content: 'x' }]));
      result.status!.should.equal(422);
      result.message!.should.equal(
        errorService.getErrorMessageByKey('unprocessable-entity'),
      );
    });

    it('answers 413 with the limit in megabytes for oversized files', async () => {
      const result = await run(
        multipart([image(Buffer.alloc(1024 * 1024 + 1, 1))]),
        1024 * 1024,
      );
      result.status!.should.equal(413);
      result.message!.should.equal(
        'Image too big. Please maximum 1.00 Mb files.',
      );
    });

    it('accepts a file above the general limit using the larger limit it is given', async () => {
      const big = Buffer.concat([png, Buffer.alloc(config.maxUploadSize + 1)]);
      (await run(multipart([image(big)]), big.length)).passed.should.be.true();
    });

    it('answers 400 naming the field when the file is in another one', async () => {
      const result = await run(multipart([image(png, 'image/png', 'other')]));
      result.status!.should.equal(400);
      result.message!.should.equal('Missing "avatar" field from the API call.');
    });

    it('answers 400 with the default message for malformed bodies', async () => {
      const req = Object.assign(Readable.from([Buffer.from('broken')]), {
        headers: { 'content-type': 'multipart/form-data; boundary=missing' },
      });
      const result = await run(req as never);
      result.status!.should.equal(400);
      result.message!.should.equal(errorService.getErrorMessageByKey());
    });
  });
});
