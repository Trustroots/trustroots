import type { Job } from 'agenda';
import mongoose, { type Types } from 'mongoose';
import nodemailer from 'nodemailer';
import config from '../../../../config/config.mts';
import log from '../../../../config/lib/logger.mjs';
import { applySupportOutboundActivity } from '../services/support-outbound-activity.server.service.mts';
import type { SupportMessageRecord } from '../models/support-message.server.model.mts';
import type { SupportRequestRecord } from '../models/support.server.model.mts';

type Data = { messageId: string };
type Done = (error?: Error | null) => void;
type RequestForEmail = Pick<
  SupportRequestRecord,
  'email' | 'lastActivityAt' | 'status' | 'statusRevision' | 'subject'
>;

const SupportMessage = mongoose.model<SupportMessageRecord>('SupportMessage');
const SupportRequest = mongoose.model<
  RequestForEmail & { _id: Types.ObjectId }
>('SupportRequest');

export async function sendSupportMessage(
  job: Pick<Job<Data>, 'attrs'>,
  done: Done,
) {
  let transport: ReturnType<typeof nodemailer.createTransport> | undefined;
  let claimedId: Types.ObjectId | undefined;
  try {
    const messageId = job.attrs.data?.messageId;
    if (!messageId) return done();
    if (!config.supportInbox.enabled) {
      await SupportMessage.updateOne(
        { _id: messageId, deliveryState: 'queued' },
        { $set: { deliveryState: 'failed', errorCode: 'inbox_disabled' } },
      );
      return done();
    }
    const message = await SupportMessage.findOneAndUpdate(
      { _id: messageId, deliveryState: 'queued' },
      {
        $set: { deliveryState: 'sending', lastAttemptAt: new Date() },
        $inc: { attempts: 1 },
      },
      { returnDocument: 'after' },
    );
    // Duplicate Agenda jobs do not claim an already-running or completed send.
    if (!message) return done();
    claimedId = message._id;

    const request = await SupportRequest.findById(message.request).lean();
    if (!request || !message.emailTo) {
      await SupportMessage.updateOne(
        { _id: message._id, deliveryState: 'sending' },
        { $set: { deliveryState: 'failed', errorCode: 'recipient_missing' } },
      );
      return done();
    }
    const expectedActivityAt = request.lastActivityAt;
    const requestSubject = (
      request.subject || 'your message to Trustroots Support'
    )
      .replace(/[\r\n]+/g, ' ')
      .trim()
      .slice(0, 998);
    const replySubject = /^re:\s*/i.test(requestSubject)
      ? requestSubject
      : `Re: ${requestSubject}`;
    transport = nodemailer.createTransport(config.mailer.options);
    const info = await transport.sendMail({
      from: {
        name: config.supportInbox.fromName,
        address: config.supportInbox.fromAddress,
      },
      to: message.emailTo,
      replyTo: config.supportInbox.fromAddress,
      subject:
        message.kind === 'acknowledgement'
          ? `We received your message: ${requestSubject}`.slice(0, 998)
          : replySubject,
      text: message.body,
      messageId: message.messageId,
      ...(message.inReplyTo && { inReplyTo: message.inReplyTo }),
      ...(message.references?.length && { references: message.references }),
      ...(message.kind === 'acknowledgement' && {
        headers: {
          'Auto-Submitted': 'auto-replied',
          'X-Auto-Response-Suppress': 'All',
        },
      }),
    });
    if (config.mailer.options.jsonTransport) {
      await SupportMessage.updateOne(
        { _id: message._id, deliveryState: 'sending' },
        { $set: { deliveryState: 'captured' }, $unset: { errorCode: 1 } },
      );
      log('info', 'Support email captured by JSON transport #TV9sJq', {
        messageId: String(message._id),
      });
      return done();
    }
    if (!info.accepted?.length) {
      await SupportMessage.updateOne(
        { _id: message._id, deliveryState: 'sending' },
        { $set: { deliveryState: 'failed', errorCode: 'recipient_rejected' } },
      );
      return done();
    }

    const acceptedAt = new Date();
    await SupportMessage.updateOne(
      { _id: message._id, deliveryState: 'sending' },
      {
        $set: {
          deliveryState: 'accepted',
          acceptedAt,
          requestActivityAt: expectedActivityAt ?? null,
        },
        $unset: { errorCode: 1 },
      },
    );
    await applySupportOutboundActivity(message._id);
    log('info', 'Support email accepted by mail transport #Pmx4kC', {
      messageId: String(message._id),
      accepted: info.accepted.length,
    });
    return done();
  } catch (error) {
    const messageId = job.attrs.data?.messageId;
    const deliveryError = error as Error & {
      code?: unknown;
      responseCode?: unknown;
    };
    const code =
      typeof deliveryError.code === 'string'
        ? deliveryError.code.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 50)
        : undefined;
    const state =
      typeof deliveryError.responseCode === 'number' ? 'failed' : 'uncertain';
    // A falsy messageId exits before any operation that can throw above, so
    // every error reaching this catch has a safe identifier to update.
    await SupportMessage.updateOne(
      { _id: claimedId || messageId, deliveryState: 'sending' },
      { $set: { deliveryState: state, ...(code && { errorCode: code }) } },
    );
    // Unknown transport outcomes require an explicit human retry confirmation;
    // let Agenda finish the job so it cannot silently send the message twice.
    log('error', 'Support email delivery did not complete #Qe8pLs', {
      messageId,
      errorCode: code || state,
    });
    return done();
  } finally {
    try {
      await transport?.close();
    } catch {
      // A close failure after send does not change the SMTP acceptance result.
    }
  }
}
