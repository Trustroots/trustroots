import type { Types } from 'mongoose';
import {
  applyPreview,
  previewReducedManifest,
} from '../../../support/server/services/status-import.server.service.mts';

interface SupportImportRequest {
  body: unknown;
  user: { _id: Types.ObjectId | string };
}

interface SupportImportResponse {
  status(code: number): SupportImportResponse;
  send(body: unknown): unknown;
}

interface SupportImportError extends Error {
  status?: number;
}

function responseFor(error: unknown) {
  const typed = error as SupportImportError;
  return {
    status: typed.status || 500,
    message:
      typed.status && typed.status < 500
        ? typed.message
        : 'Unable to process support status import.',
  };
}

export async function preview(
  req: SupportImportRequest,
  res: SupportImportResponse,
): Promise<unknown> {
  try {
    return res.send(await previewReducedManifest(req.body, req.user._id));
  } catch (error) {
    const response = responseFor(error);
    return res.status(response.status).send({ message: response.message });
  }
}

export async function apply(
  req: SupportImportRequest,
  res: SupportImportResponse,
): Promise<unknown> {
  try {
    if (
      typeof req.body !== 'object' ||
      req.body === null ||
      Array.isArray(req.body) ||
      Object.keys(req.body).length !== 1 ||
      !('previewId' in req.body) ||
      typeof req.body.previewId !== 'string'
    ) {
      return res
        .status(400)
        .send({ message: 'Invalid support status preview.' });
    }
    return res.send(await applyPreview(req.body.previewId, req.user._id));
  } catch (error) {
    const response = responseFor(error);
    return res.status(response.status).send({ message: response.message });
  }
}

const api = { preview, apply };
export default api;
export { api as 'module.exports' };
