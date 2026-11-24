import { randomBytes } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import { match, P } from 'ts-pattern';

import config from './../../../../config/config.mts';
import * as errorService from './error.server.service.mts';

export interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  path?: string;
}
type UploadBody = Readable & { headers: IncomingHttpHeaders };
type UploadRequest = UploadBody & {
  body?: Record<string, unknown>;
  file?: Partial<UploadedFile>;
};
interface UploadResponse {
  status(code: number): { send(body: { message: string }): unknown };
}
export type UploadError = Error & {
  code: 'LIMIT_FILE_SIZE' | 'LIMIT_UNEXPECTED_FILE' | 'INVALID_MULTIPART';
};

function uploadError(code: UploadError['code']): UploadError {
  return Object.assign(new Error(code), { code });
}

async function detectMimeType(buffer: Buffer): Promise<string> {
  if (process.env.TRUSTROOTS_FILE_MAGIC_FALLBACK !== 'true') {
    const { fileTypeFromBuffer } = await import('file-type');
    const detected = await fileTypeFromBuffer(buffer);
    if (detected) return detected.mime;
  }
  return match(buffer.toString('latin1', 0, 256))
    .with(P.string.startsWith('\xff\xd8\xff'), () => 'image/jpeg')
    .with(P.string.startsWith('\x89PNG'), () => 'image/png')
    .with(P.string.startsWith('GIF'), () => 'image/gif')
    .with(P.string.startsWith('%PDF'), () => 'application/pdf')
    .with(P.string.regex(/^\s*(<\?xml[\s\S]*)?<svg/i), () => 'image/svg+xml')
    .otherwise(() => 'application/octet-stream');
}

/**
 * Read the single file and the text fields of a multipart request with the
 * standard `Request.formData()`. Rejects with an `UploadError`; resolves to
 * `undefined` when the request is not multipart or carries no file.
 */
export async function readUpload(
  req: UploadBody,
  uploadField: string,
  maxUploadSize: number,
): Promise<{ file: UploadedFile; fields: Record<string, string> } | undefined> {
  const contentType = req.headers['content-type'] ?? '';
  if (!/^multipart\/form-data\s*(;|$)/i.test(contentType)) {
    return undefined;
  }
  // Room for the multipart boundaries and the other form fields. Computed
  // per call so Stryker's per-test coverage sees the tests that check it.
  const limit = maxUploadSize + 64 * 1024;
  if (Number(req.headers['content-length']) > limit) {
    throw uploadError('LIMIT_FILE_SIZE');
  }
  let received = 0;
  async function* body() {
    for await (const chunk of req) {
      received += chunk.length;
      if (received > limit) {
        throw new RangeError();
      }
      yield chunk;
    }
  }
  let form: FormData;
  try {
    form = await new Request('http://localhost/', {
      method: 'POST',
      headers: { 'content-type': contentType },
      body: ReadableStream.from(body()),
      duplex: 'half',
    } as RequestInit).formData();
  } catch {
    throw uploadError(
      received > limit ? 'LIMIT_FILE_SIZE' : 'INVALID_MULTIPART',
    );
  }
  const entries = [...form];
  const files = entries.filter(
    (entry): entry is [string, File] =>
      entry[1] instanceof File && entry[1].name !== '',
  );
  if (
    entries.length > 11 ||
    files.length > 1 ||
    files.some(([name]) => name !== uploadField)
  ) {
    throw uploadError('LIMIT_UNEXPECTED_FILE');
  }
  const file = files[0]?.[1];
  if (!file) return undefined;
  if (file.size > maxUploadSize) throw uploadError('LIMIT_FILE_SIZE');
  return {
    file: {
      buffer: Buffer.from(await file.arrayBuffer()),
      mimetype: file.type,
      originalname: file.name,
    },
    fields: Object.fromEntries(
      entries.filter(
        (entry): entry is [string, string] => !(entry[1] instanceof File),
      ),
    ),
  };
}

/**
 * Upload file handler and validator: reads the multipart file, checks its
 * declared type and magic bytes, and places it in a temp folder, with its
 * path in `req.file.path` and the text fields in `req.body`.
 */
export const uploadFile = async (
  validMimeTypes: string[],
  uploadField: string,
  req: UploadRequest,
  res: UploadResponse,
  next: () => void,
  maxUploadSize = config.maxUploadSize,
) => {
  try {
    const upload = await readUpload(req, uploadField, maxUploadSize);
    if (!upload) {
      return res.status(422).send({
        message: errorService.getErrorMessageByKey('unprocessable-entity'),
      });
    }
    const { file, fields } = upload;
    // Browsers send application/octet-stream when File.type is empty, so the
    // bytes decide; the declared type is never trusted on its own.
    if (
      (file.mimetype !== 'application/octet-stream' &&
        !validMimeTypes.includes(file.mimetype)) ||
      !validMimeTypes.includes(await detectMimeType(file.buffer))
    ) {
      return res.status(415).send({
        message: errorService.getErrorMessageByKey('unsupported-media-type'),
      });
    }
    const uploadDirectory = path.resolve(config.uploadTmpDir || os.tmpdir());
    const uploadPath = path.join(
      uploadDirectory,
      randomBytes(16).toString('hex'),
    );
    await fs.promises.mkdir(uploadDirectory, { recursive: true });
    await fs.promises.writeFile(uploadPath, file.buffer, { mode: 0o600 });
    req.body = fields;
    req.file = { ...file, path: uploadPath };
  } catch (error) {
    const [status, message] = match((error as UploadError).code)
      .with(
        'LIMIT_FILE_SIZE',
        () =>
          [
            413,
            `Image too big. Please maximum ${(maxUploadSize / (1024 * 1024)).toFixed(2)} Mb files.`,
          ] as const,
      )
      .with(
        'LIMIT_UNEXPECTED_FILE',
        () =>
          [400, `Missing "${uploadField}" field from the API call.`] as const,
      )
      .otherwise(() => [400, errorService.getErrorMessageByKey()] as const);
    return res.status(status).send({ message });
  }
  next();
};
