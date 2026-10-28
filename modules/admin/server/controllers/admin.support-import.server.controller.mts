import type { Types } from 'mongoose';
import {
  applyPreview,
  previewReducedManifest,
} from '../../../support/server/services/status-import.server.service.mts';
import type { SupportStatusImportSelection } from '../../../support/shared/status-import.ts';

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

function isSelection(value: unknown): value is SupportStatusImportSelection {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 2 &&
    'zendeskTicketId' in value &&
    typeof value.zendeskTicketId === 'number' &&
    Number.isSafeInteger(value.zendeskTicketId) &&
    value.zendeskTicketId > 0 &&
    'requestId' in value &&
    typeof value.requestId === 'string' &&
    /^[a-f\d]{24}$/i.test(value.requestId)
  );
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
    const body = req.body;
    if (
      typeof body !== 'object' ||
      body === null ||
      Array.isArray(body) ||
      !('previewId' in body) ||
      typeof body.previewId !== 'string' ||
      Object.keys(body).some(
        key => !['previewId', 'selectedMatches'].includes(key),
      ) ||
      ('selectedMatches' in body &&
        (!Array.isArray(body.selectedMatches) ||
          !body.selectedMatches.every(isSelection)))
    ) {
      return res
        .status(400)
        .send({ message: 'Invalid support status preview.' });
    }
    const selectedMatches =
      'selectedMatches' in body
        ? (body.selectedMatches as SupportStatusImportSelection[])
        : undefined;
    return res.send(
      await applyPreview(body.previewId, req.user._id, selectedMatches),
    );
  } catch (error) {
    const response = responseFor(error);
    return res.status(response.status).send({ message: response.message });
  }
}

const api = { preview, apply };
export default api;
export { api as 'module.exports' };
