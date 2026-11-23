import { randomBytes } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';

import config from './../../../../config/config.mts';
import * as errorService from './error.server.service.mts';

export interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  path?: string;
  fields?: Record<string, string>;
}
type UploadBody = Readable & { headers: IncomingHttpHeaders };
type UploadRequest = UploadBody & {
  file?: Partial<UploadedFile>;
  body?: Record<string, string>;
};
interface UploadResponse {
  status(code: number): { send(body: { message: string }): unknown };
}
export type UploadError = Error & { code: string };

// Room for the multipart boundaries and the other form fields
const MULTIPART_OVERHEAD = 64 * 1024;
const MAX_PARTS = 11;

function uploadError(code: string): UploadError {
  return Object.assign(new Error(code), { code });
}

function detectMimeTypeFallback(buffer: Buffer): string {
  const header = buffer.toString('utf8', 0, 256).trim();
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return 'image/png';
  }
  if (buffer.toString('ascii', 0, 3) === 'GIF') {
    return 'image/gif';
  }
  if (buffer.toString('ascii', 0, 4) === '%PDF') {
    return 'application/pdf';
  }
  if (/^<\?xml[\s\S]*<svg|^<svg/i.test(header)) {
    return 'image/svg+xml';
  }
  return 'application/octet-stream';
}
async function detectMimeType(buffer: Buffer): Promise<string> {
  if (process.env.TRUSTROOTS_FILE_MAGIC_FALLBACK === 'true') {
    return detectMimeTypeFallback(buffer);
  }
  const { fileTypeFromBuffer } = await import('file-type');
  return (
    (await fileTypeFromBuffer(buffer))?.mime ?? detectMimeTypeFallback(buffer)
  );
}

/**
 * Read the single file of a multipart request with the standard
 * `Request.formData()`. Rejects with an error whose `code` is
 * `LIMIT_FILE_SIZE`, `LIMIT_UNEXPECTED_FILE` or `INVALID_MULTIPART`;
 * resolves to `undefined` when the request is not multipart or carries no file.
 */
export async function readUpload(
  req: UploadBody,
  uploadField: string,
  maxUploadSize: number,
): Promise<UploadedFile | undefined> {
  const contentType = req.headers['content-type'] ?? '';
  const mediaType = contentType.split(';', 1)[0]!.trim().toLowerCase();
  if (mediaType !== 'multipart/form-data') {
    return undefined;
  }
  const limit = maxUploadSize + MULTIPART_OVERHEAD;
  if (Number(req.headers['content-length']) > limit) {
    throw uploadError('LIMIT_FILE_SIZE');
  }
  let received = 0;
  let tooBig = false;
  async function* body() {
    for await (const chunk of req) {
      received += chunk.length;
      if (received > limit) {
        tooBig = true;
        throw uploadError('LIMIT_FILE_SIZE');
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
    throw uploadError(tooBig ? 'LIMIT_FILE_SIZE' : 'INVALID_MULTIPART');
  }
  const entries = [...form];
  const files = entries.filter(
    (entry): entry is [string, File] =>
      entry[1] instanceof File && entry[1].name !== '',
  );
  if (
    entries.length > MAX_PARTS ||
    files.length > 1 ||
    files.some(([name]) => name !== uploadField)
  ) {
    throw uploadError('LIMIT_UNEXPECTED_FILE');
  }
  const file = files[0]?.[1];
  if (!file) return undefined;
  if (file.size > maxUploadSize) throw uploadError('LIMIT_FILE_SIZE');
  return {
    buffer: Buffer.from(await file.arrayBuffer()),
    mimetype: file.type,
    originalname: file.name,
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
 * path in `req.file.path`.
 *
 * @link https://www.npmjs.com/package/file-type
 *
 * @param {Array} validMimeTypes - List of mime types filter should accept
 * @param {String} uploadField - Name of the POST upload field in the multipart-form
 * @param {Object} req - Express.js middleware request
 * @param {Object} res - Express.js middleware response
 * @param {Function} next — Next middleware function
 * @param {Number} maxUploadSize - Maximum file size in bytes
 */
export const uploadFile = async (
  validMimeTypes: string[],
  uploadField: string,
  req: UploadRequest,
  res: UploadResponse,
  next: () => void,
  maxUploadSize = config.maxUploadSize,
) => {
  const unsupported = () =>
    res.status(415).send({
      message: errorService.getErrorMessageByKey('unsupported-media-type'),
    });
  try {
    const file = await readUpload(req, uploadField, maxUploadSize);
    if (!file) {
      return res.status(422).send({
        message: errorService.getErrorMessageByKey('unprocessable-entity'),
      });
    }
    // Browsers send application/octet-stream when File.type is empty.
    // Let the content detector below validate these files by their bytes.
    if (
      !validMimeTypes.includes(file.mimetype) &&
      file.mimetype !== 'application/octet-stream'
    ) {
      return unsupported();
    }
    // The declared type is not trusted: check the magic bytes too.
    if (!validMimeTypes.includes(await detectMimeType(file.buffer))) {
      return unsupported();
    }
    const uploadDirectory = path.resolve(config.uploadTmpDir || os.tmpdir());
    const uploadPath = path.join(
      uploadDirectory,
      randomBytes(16).toString('hex'),
    );
    await fs.promises.mkdir(uploadDirectory, { recursive: true });
    await fs.promises.writeFile(uploadPath, file.buffer, { mode: 0o600 });
    const { fields, ...upload } = file;
    req.body = fields;
    req.file = { ...upload, path: uploadPath };
  } catch (error) {
    const code = (error as UploadError).code;
    if (code === 'LIMIT_FILE_SIZE') {
      const maxUploadSizeMb = (maxUploadSize / (1024 * 1024)).toFixed(2);
      return res.status(413).send({
        message: `Image too big. Please maximum ${maxUploadSizeMb} Mb files.`,
      });
    }
    if (code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).send({
        message: `Missing "${uploadField}" field from the API call.`,
      });
    }
    return res.status(400).send({
      message: errorService.getErrorMessageByKey(),
    });
  }
  next();
};
