import { randomUUID } from 'node:crypto';
import mongoose, { type Types } from 'mongoose';
import validator from 'validator';
import agendaModule from '../../../../config/lib/agenda.mjs';
import config from '../../../../config/config.mts';
import type { SupportMessageRecord } from '../models/support-message.server.model.mts';
import type { SupportRequestRecord } from '../models/support.server.model.mts';

export interface SupportEmailActor {
  _id: string | Types.ObjectId;
  displayName?: string;
  username?: string;
}

export class SupportEmailError extends Error {
  code: 'disabled' | 'not-found' | 'invalid' | 'conflict' | 'uncertain';
  status: number;

  constructor(code: SupportEmailError['code'], message: string) {
    super(message);
    this.name = 'SupportEmailError';
    this.code = code;
    this.status = {
      disabled: 503,
      'not-found': 404,
      invalid: 400,
      conflict: 409,
      uncertain: 409,
    }[code];
  }
}

const agenda = agendaModule as import('agenda').Agenda;
const SupportRequest = mongoose.model<SupportRequestRecord>('SupportRequest');
const SupportMessage = mongoose.model<SupportMessageRecord>('SupportMessage');
const MAX_BODY_LENGTH = 20000;

function ensureEnabled() {
  if (!config.supportInbox.enabled) {
    throw new SupportEmailError('disabled', 'Support inbox is disabled');
  }
}

function cleanBody(value: unknown): string {
  if (typeof value !== 'string') {
    throw new SupportEmailError('invalid', 'Reply body must be text');
  }
  const body = value.replace(/\r\n?/g, '\n').trim();
  if (!body || body.length > MAX_BODY_LENGTH) {
    throw new SupportEmailError('invalid', 'Reply body length is invalid');
  }
  return body;
}

function messageId() {
  const domain =
    config.supportInbox.fromAddress.split('@').at(-1) || 'localhost';
  if (!validator.isEmail(config.supportInbox.fromAddress)) {
    throw new SupportEmailError(
      'disabled',
      'Support sender address is not configured',
    );
  }
  return `<${randomUUID()}@${domain}>`;
}

async function enqueue(message: SupportMessageRecord) {
  const created = await SupportMessage.create(message);
  try {
    await agenda
      .create('send support message', { messageId: String(created._id) })
      .save();
  } catch (error) {
    await SupportMessage.updateOne(
      { _id: created._id, deliveryState: 'queued' },
      {
        $set: {
          // Acknowledgements are sent automatically and can be recovered by
          // the queued-message sweep. Replies remain failed so an operator
          // can explicitly choose when to retry them.
          deliveryState:
            created.kind === 'acknowledgement' ? 'queued' : 'failed',
          errorCode: 'queue_failed',
        },
      },
    );
    throw error;
  }
  return created.toObject();
}

async function queueForRequest(
  requestId: string,
  actor: SupportEmailActor | undefined,
  rawBody: unknown,
  rawIdempotencyKey: unknown,
  kind: 'reply' | 'acknowledgement',
) {
  ensureEnabled();
  const body = cleanBody(rawBody);
  const idempotencyKey =
    typeof rawIdempotencyKey === 'string' && rawIdempotencyKey.trim()
      ? rawIdempotencyKey.trim()
      : undefined;
  if (!idempotencyKey) {
    throw new SupportEmailError('invalid', 'An idempotency key is required');
  }
  if (idempotencyKey.length > 200) {
    throw new SupportEmailError('invalid', 'Idempotency key is too long');
  }
  const request = await SupportRequest.findById(requestId).lean();
  if (!request)
    throw new SupportEmailError('not-found', 'Support request not found');
  if (!request.email || !validator.isEmail(request.email)) {
    throw new SupportEmailError(
      'invalid',
      'Request has no valid email address',
    );
  }

  const existing = await SupportMessage.findOne({
    request: request._id,
    $or: [{ idempotencyKey }, { idempotencyKeys: idempotencyKey }],
  }).lean();
  if (existing) {
    if (existing.kind !== kind || existing.body !== body) {
      throw new SupportEmailError(
        'conflict',
        'Idempotency key was already used',
      );
    }
    return existing;
  }

  const references = [request.initialMessageId].filter(
    (reference): reference is string => Boolean(reference),
  );
  const latest = await SupportMessage.findOne({ request: request._id })
    .sort({ createdAt: -1, _id: -1 })
    .lean();
  if (latest?.messageId && !references.includes(latest.messageId)) {
    references.push(latest.messageId);
  }

  const emailMessage: SupportMessageRecord = {
    request: request._id,
    direction: 'outbound',
    kind,
    body,
    createdAt: new Date(),
    ...(actor && {
      authorId: new mongoose.Types.ObjectId(actor._id),
      authorName: actor.displayName || actor.username,
    }),
    emailFrom: config.supportInbox.fromAddress,
    emailTo: request.email,
    messageId: messageId(),
    ...((latest?.messageId || request.initialMessageId) && {
      inReplyTo: latest?.messageId || request.initialMessageId,
    }),
    references,
    idempotencyKey,
    idempotencyKeys: [idempotencyKey],
    deliveryState: 'queued',
    attempts: 0,
    requestRevision: request.statusRevision,
  };
  try {
    return await enqueue(emailMessage);
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 11000
    ) {
      const existing = await SupportMessage.findOne({
        request: request._id,
        $or: [{ idempotencyKey }, { idempotencyKeys: idempotencyKey }],
      }).lean();
      if (existing) {
        if (existing.kind !== kind || existing.body !== body) {
          throw new SupportEmailError(
            'conflict',
            'Idempotency key was already used',
          );
        }
        return existing;
      }
    }
    throw error;
  }
}

export async function queueReply(
  requestId: string,
  actor: SupportEmailActor,
  body: unknown,
  idempotencyKey: unknown,
) {
  return queueForRequest(requestId, actor, body, idempotencyKey, 'reply');
}

export async function retryReply(
  requestId: string,
  messageIdValue: string,
  _actor: SupportEmailActor,
  idempotencyKey: unknown,
  confirmUncertain: unknown,
) {
  ensureEnabled();
  if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    throw new SupportEmailError('invalid', 'An idempotency key is required');
  }
  const retryKey = idempotencyKey.trim();
  if (retryKey.length > 200) {
    throw new SupportEmailError('invalid', 'Idempotency key is too long');
  }
  const priorRetry = await SupportMessage.findOne({
    request: requestId,
    $or: [{ idempotencyKey: retryKey }, { idempotencyKeys: retryKey }],
  }).lean();
  if (priorRetry) {
    if (String(priorRetry._id) !== messageIdValue) {
      throw new SupportEmailError(
        'conflict',
        'Idempotency key was already used',
      );
    }
    if (
      ['queued', 'sending', 'accepted', 'captured'].includes(
        priorRetry.deliveryState,
      )
    ) {
      return priorRetry;
    }
  }
  const message = await SupportMessage.findOne({
    _id: messageIdValue,
    request: requestId,
    direction: 'outbound',
    kind: 'reply',
  });
  if (!message)
    throw new SupportEmailError('not-found', 'Support reply not found');
  const request = await SupportRequest.findById(requestId).lean();
  if (!request)
    throw new SupportEmailError('not-found', 'Support request not found');
  if (message.deliveryState === 'uncertain' && confirmUncertain !== true) {
    throw new SupportEmailError(
      'uncertain',
      'Confirm retry of uncertain delivery',
    );
  }
  if (!['failed', 'uncertain'].includes(message.deliveryState)) {
    throw new SupportEmailError(
      'conflict',
      'Reply cannot be retried in its current state',
    );
  }
  let claimed;
  try {
    claimed = await SupportMessage.findOneAndUpdate(
      {
        _id: message._id,
        request: requestId,
        deliveryState: message.deliveryState,
      },
      {
        $set: {
          deliveryState: 'queued',
          requestRevision: request.statusRevision,
          requestActivityAt: request.lastActivityAt ?? null,
        },
        $addToSet: { idempotencyKeys: retryKey },
        $unset: {
          errorCode: 1,
          activityAppliedAt: 1,
          acceptedAt: 1,
        },
      },
      { returnDocument: 'after' },
    );
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 11000
    ) {
      throw new SupportEmailError(
        'conflict',
        'Idempotency key was already used',
      );
    }
    throw error;
  }
  if (!claimed) {
    const current = await SupportMessage.findById(message._id).lean();
    if (
      (current?.idempotencyKey === retryKey ||
        current?.idempotencyKeys?.includes(retryKey)) &&
      ['queued', 'sending', 'accepted', 'captured'].includes(
        current.deliveryState,
      )
    ) {
      return current;
    }
    throw new SupportEmailError(
      'conflict',
      'Reply changed while retry was queued',
    );
  }
  try {
    await agenda
      .create('send support message', { messageId: String(claimed._id) })
      .save();
  } catch (error) {
    await SupportMessage.updateOne(
      { _id: claimed._id, deliveryState: 'queued' },
      { $set: { deliveryState: 'failed', errorCode: 'queue_failed' } },
    );
    throw error;
  }
  return claimed.toObject();
}

export async function queueAcknowledgement(requestId: string) {
  return queueForRequest(
    requestId,
    undefined,
    'We have received your message. A member of our team will reply as soon as possible.',
    `ack:${requestId}`,
    'acknowledgement',
  );
}
