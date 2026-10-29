import type { Job } from 'agenda';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import {
  MailParser,
  type AttachmentStream,
  type MessageText,
} from 'mailparser';
import {
  ImapFlow,
  type MessageEnvelopeObject,
  type MessageStructureObject,
  type FetchMessageObject,
} from 'imapflow';
import mongoose, { type Types } from 'mongoose';
import config from '../../../../config/config.mts';
import log from '../../../../config/lib/logger.mjs';
import type { SupportMessageRecord } from '../models/support-message.server.model.mts';
import type { SupportRequestRecord } from '../models/support.server.model.mts';
import { startSupportMailboxHeartbeat } from '../services/support-mailbox-heartbeat.server.service.mts';

type Done = (error?: Error | null) => void;
type MailboxRequest = SupportRequestRecord & { _id: Types.ObjectId };
const SupportRequest = mongoose.model<MailboxRequest>('SupportRequest');
const SupportMessage = mongoose.model<SupportMessageRecord>('SupportMessage');
const SupportMailboxCursor = mongoose.model<{
  _id: string;
  uidValidity: string;
  lastUid: number;
  cutoverAt: Date;
  rescanThroughUid?: number;
  updatedAt: Date;
}>('SupportMailboxCursor');

interface ParsedSupportMail {
  body: string;
  sender?: string;
  subject?: string;
  messageId?: string;
  inReplyTo?: string;
  references: string[];
  attachments: Array<{
    filename?: string;
    contentType?: string;
    size?: number;
  }>;
  automated: boolean;
  deliveryStatus?: 'failed' | 'delayed' | 'delivered';
  reportedMessageId?: string;
}

function normaliseMessageId(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const inner = trimmed.replace(/^<|>$/g, '');
  if (!inner.includes('@') || /[\s<>\r\n]/.test(inner)) return undefined;
  return `<${inner}>`;
}

function fallbackMessageId() {
  const domain =
    config.supportInbox.fromAddress.split('@').at(-1) || 'localhost';
  return `<${randomUUID()}@${domain}>`;
}

function headerText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(', ');
  return String((value as { value?: unknown } | null | undefined)?.value ?? '');
}

export async function parseSupportMailSource(
  source: NodeJS.ReadableStream,
  maxLength: number,
): Promise<ParsedSupportMail> {
  const parser = new MailParser({
    skipHtmlToText: false,
    keepDeliveryStatus: true,
    maxHtmlLengthToParse: maxLength,
  });
  const attachments: ParsedSupportMail['attachments'] = [];
  let body = '';
  let deliveryStatusPart = '';
  parser.on('data', (part: AttachmentStream | MessageText) => {
    if (part.type === 'attachment') {
      const metadata = {
        filename: part.filename?.slice(0, 255),
        contentType: part.contentType?.slice(0, 120),
        size: part.size,
      };
      attachments.push(metadata);
      if (part.contentType.toLowerCase() === 'message/delivery-status') {
        let collected = 0;
        part.content.on('data', (chunk: Buffer) => {
          if (collected >= 65536) return;
          const safeChunk = chunk.subarray(0, 65536 - collected);
          deliveryStatusPart += safeChunk.toString('utf8');
          collected += safeChunk.byteLength;
        });
      }
      part.content.resume();
      part.content.once('end', () => {
        metadata.size = part.size;
        part.release?.();
      });
    } else {
      body = part.text || '';
    }
  });
  await pipeline(source, parser);
  // The completed MailParser stream always has a root header map, including
  // empty messages; `false` is only its pre-parse initial state.
  const headers = parser.headers as Exclude<typeof parser.headers, false>;
  const autoSubmitted = headerText(headers.get('auto-submitted'));
  const contentTypeHeader = headers.get('content-type');
  const contentType = headerText(contentTypeHeader);
  const reportType =
    contentTypeHeader &&
    typeof contentTypeHeader === 'object' &&
    'params' in contentTypeHeader &&
    contentTypeHeader.params &&
    typeof contentTypeHeader.params === 'object' &&
    'report-type' in contentTypeHeader.params
      ? String(contentTypeHeader.params['report-type'])
      : '';
  const from = parser.from?.value.find(address => address.address)?.address;
  const deliveryAction = deliveryStatusPart
    .match(/^Action:\s*(failed|delayed|delivered)\s*$/im)?.[1]
    ?.toLowerCase() as ParsedSupportMail['deliveryStatus'];
  const reportedMessageId = normaliseMessageId(
    deliveryStatusPart.match(
      /^Original-Message-ID:\s*(<[^>\r\n]+>)\s*$/im,
    )?.[1],
  );
  const referenceHeader = parser.references;
  const references = (
    referenceHeader ? ([] as string[]).concat(referenceHeader) : []
  )
    .map(reference => normaliseMessageId(reference))
    .filter((reference): reference is string => Boolean(reference));
  return {
    body,
    sender: from?.trim(),
    subject: parser.subject,
    messageId: normaliseMessageId(parser.messageId),
    inReplyTo: normaliseMessageId(parser.inReplyTo),
    references,
    attachments,
    automated:
      (Boolean(autoSubmitted) && autoSubmitted.toLowerCase() !== 'no') ||
      (/multipart\/report/i.test(contentType) &&
        reportType.toLowerCase() === 'delivery-status') ||
      /^(postmaster|mailer-daemon)@/i.test(from || ''),
    ...(deliveryAction && { deliveryStatus: deliveryAction }),
    ...(reportedMessageId && { reportedMessageId }),
  } satisfies ParsedSupportMail;
}

export type { ParsedSupportMail };

function touchAgendaJob(job: Pick<Job, 'touch'>) {
  return job.touch.call(job as Job);
}

async function findThread(references: string[], inReplyTo?: string) {
  if (inReplyTo) {
    const exactInitial = await SupportRequest.find({
      initialMessageId: inReplyTo,
    }).limit(2);
    if (exactInitial.length === 1) return exactInitial[0];
    const exactReply = await SupportMessage.findOne({
      messageId: inReplyTo,
    }).select('request');
    if (exactReply) return SupportRequest.findById(exactReply.request);
    if (exactInitial.length > 1) return undefined;
  }
  if (!references.length) return undefined;

  const matchingRequests = await SupportRequest.find({
    initialMessageId: { $in: references },
  })
    .select('_id')
    .limit(3)
    .lean();
  const matchingReplies = await SupportMessage.find({
    messageId: { $in: references },
  })
    .select('request')
    .limit(3)
    .lean();
  const requestIds = new Set([
    ...matchingRequests.map(request => String(request._id)),
    ...matchingReplies.map(reply => String(reply.request)),
  ]);
  if (requestIds.size !== 1) return undefined;
  return SupportRequest.findById([...requestIds][0]);
}

function addressFromEnvelope(envelope?: MessageEnvelopeObject) {
  return envelope?.from?.find(address => address.address)?.address?.trim();
}

function attachmentMetadata(structure?: MessageStructureObject) {
  if (!structure) return [];
  const attachments: ParsedSupportMail['attachments'] = [];
  const visit = (part: MessageStructureObject) => {
    if (
      part.disposition?.toLowerCase() === 'attachment' ||
      part.dispositionParameters?.filename
    ) {
      attachments.push({
        filename: part.dispositionParameters?.filename?.slice(0, 255),
        contentType: part.type.slice(0, 120),
        size: part.size,
      });
    }
    part.childNodes?.forEach(visit);
  };
  visit(structure);
  return attachments;
}

function headerValue(headers: Buffer | undefined, name: string) {
  if (!headers) return '';
  const raw = headers.toString('utf8');
  const match = raw.match(
    new RegExp(`^${name}:\\s*(.+(?:\\r?\\n[ \\t].+)*)`, 'im'),
  );
  return match?.[1].replace(/\r?\n[ \t]+/g, ' ').trim() || '';
}

function limitStoredBody(value: string) {
  const maxBytes = config.supportInbox.imap.maxStoredBodyBytes;
  if (Buffer.byteLength(value, 'utf8') <= maxBytes) {
    return { body: value, truncated: false };
  }
  const note = `\n[Message text truncated after ${Math.floor(maxBytes / 1024 / 1024)} MiB]`;
  const contentLimit = Math.max(0, maxBytes - Buffer.byteLength(note, 'utf8'));
  let lower = 0;
  let upper = value.length;
  while (lower < upper) {
    const middle = Math.ceil((lower + upper) / 2);
    if (Buffer.byteLength(value.slice(0, middle), 'utf8') <= contentLimit) {
      lower = middle;
    } else {
      upper = middle - 1;
    }
  }
  if (lower > 0 && /[\uD800-\uDBFF]/.test(value.charAt(lower - 1))) lower -= 1;
  return { body: `${value.slice(0, lower)}${note}`, truncated: true };
}

async function processMail(
  parsed: ParsedSupportMail,
  envelope: MessageEnvelopeObject | undefined,
  internalDate: Date | undefined,
  inboundKey: string,
  oversized: boolean,
) {
  if (await SupportRequest.exists({ initialInboundKey: inboundKey })) return;
  const priorInbound = await SupportMessage.findOne({ inboundKey });
  if (priorInbound) {
    if (!priorInbound.activityAppliedAt)
      await applyInboundActivity(priorInbound);
    return;
  }

  if (parsed.deliveryStatus === 'failed') {
    const referencedIds = [
      parsed.reportedMessageId,
      parsed.inReplyTo,
      ...parsed.references,
    ].filter((value): value is string => Boolean(value));
    if (!referencedIds.length) return;
    const outbound = await SupportMessage.findOne({
      direction: 'outbound',
      messageId: { $in: referencedIds },
      deliveryState: 'accepted',
    }).lean();
    if (!outbound) return;
    const failed = await SupportMessage.updateOne(
      { _id: outbound._id, deliveryState: 'accepted' },
      { $set: { deliveryState: 'failed', errorCode: 'delivery_bounced' } },
    );
    if (failed.modifiedCount) {
      const bouncedAt = internalDate || new Date();
      await SupportRequest.updateOne(
        {
          _id: outbound.request,
          status: 'pending',
          statusRevision: outbound.requestRevision,
          lastActivityAt: outbound.acceptedAt ?? null,
        },
        {
          $set: {
            status: 'open',
            statusChangedAt: bouncedAt,
            lastActivityAt: bouncedAt,
            resolvedAt: null,
            resolvedBy: null,
          },
          $inc: { statusRevision: 1 },
        },
      );
    }
    return;
  }

  const sender = (
    parsed.sender || addressFromEnvelope(envelope)
  )?.toLowerCase();
  if (!sender || sender === config.supportInbox.fromAddress.toLowerCase())
    return;
  const references = parsed.references;
  const thread = await findThread(
    references,
    parsed.inReplyTo || normaliseMessageId(envelope?.inReplyTo),
  );
  // Thread headers are untrusted. Never attach mail from a different sender to
  // a request simply because it knows a Message-ID.
  const matchingThread =
    thread?.email?.toLowerCase() === sender ? thread : undefined;
  const activityAt = internalDate || new Date();
  const bounded = oversized
    ? {
        body: '[Message exceeds configured size limit; content omitted]',
        truncated: true,
      }
    : limitStoredBody(parsed.body.trim() || '[Message body unavailable]');
  const body = bounded.body;
  const truncated = oversized || bounded.truncated;
  const attachments = parsed.attachments;
  const incomingId =
    parsed.messageId || normaliseMessageId(envelope?.messageId);
  if (!matchingThread) {
    await SupportRequest.create({
      category: 'other',
      status: 'new',
      sent: activityAt,
      email: sender,
      message: body,
      subject: (parsed.subject || envelope?.subject || 'Email support request')
        .replace(/[\r\n]+/g, ' ')
        .slice(0, 998),
      ...(incomingId && { initialMessageId: incomingId }),
      initialInboundKey: inboundKey,
      initialReferences: references,
      initialAttachments: attachments,
      oversized,
      truncated,
      lastActivityAt: activityAt,
      statusChangedAt: activityAt,
      statusRevision: 0,
    });
    return;
  }

  // An external sender can reuse an outbound Message-ID. Keep the inbound
  // deduplication key, but give this distinct message its own threading ID.
  const storedMessageId =
    incomingId && !(await SupportMessage.exists({ messageId: incomingId }))
      ? incomingId
      : fallbackMessageId();
  const inbound = await SupportMessage.create({
    request: matchingThread._id,
    direction: 'inbound',
    kind: 'reply',
    body,
    createdAt: activityAt,
    emailFrom: sender,
    emailTo: config.supportInbox.fromAddress,
    messageId: storedMessageId,
    ...((parsed.inReplyTo || normaliseMessageId(envelope?.inReplyTo)) && {
      inReplyTo: parsed.inReplyTo || normaliseMessageId(envelope?.inReplyTo),
    }),
    references,
    inboundKey,
    deliveryState: 'received',
    attempts: 0,
    attachments,
    oversized,
    truncated,
    requestRevision: matchingThread.statusRevision,
  });
  await applyInboundActivity(inbound);
}

async function applyInboundActivity(
  message: InstanceType<typeof SupportMessage>,
) {
  const request = await SupportRequest.findById(message.request).lean();
  if (request && message.requestRevision !== undefined) {
    await SupportRequest.updateOne(
      { _id: request._id, statusRevision: message.requestRevision },
      {
        $set: {
          status: 'open',
          lastActivityAt: message.createdAt,
          ...(request.status !== 'open' && {
            statusChangedAt: message.createdAt,
          }),
          resolvedAt: null,
          resolvedBy: null,
        },
        $inc: { statusRevision: 1 },
      },
    );
  }
  await SupportMessage.updateOne(
    { _id: message._id, activityAppliedAt: { $exists: false } },
    { $set: { activityAppliedAt: new Date() } },
  );
}

export async function pollSupportMailbox(
  job: Pick<Job, 'attrs' | 'touch'>,
  done: Done,
) {
  const mailbox = config.supportInbox.imap;
  if (!config.supportInbox.enabled || !mailbox.enabled) return done();
  if (!mailbox.secure) return done(new Error('Support mailbox requires TLS'));
  if (!mailbox.host || !mailbox.user || !mailbox.password) {
    return done(new Error('Support mailbox configuration is incomplete'));
  }
  const client = new ImapFlow({
    host: mailbox.host,
    port: mailbox.port,
    secure: mailbox.secure,
    tls: { rejectUnauthorized: true },
    auth: { user: mailbox.user, pass: mailbox.password },
    logger: false,
  });
  const heartbeat = startSupportMailboxHeartbeat(job);
  let connectionError: Error | undefined;
  client.on('error', error => {
    connectionError = error;
    client.close();
  });
  function assertHealthy() {
    if (connectionError) throw connectionError;
    heartbeat.assertHealthy();
  }
  try {
    await client.connect();
    const lock = await client.getMailboxLock(mailbox.mailbox, {
      readOnly: true,
    });
    try {
      const openedMailbox = client.mailbox;
      if (!openedMailbox)
        throw new Error('Support mailbox could not be opened');
      const uidValidity = String(openedMailbox.uidValidity || 'unknown');
      const cursor =
        await SupportMailboxCursor.findById('support-inbox').lean();
      if (!cursor) {
        // The first activation establishes the cutover at the mailbox end.
        // Historical messages require a deliberate import path.
        const cutoverAt = new Date();
        await SupportMailboxCursor.updateOne(
          { _id: 'support-inbox' },
          {
            $set: {
              uidValidity,
              lastUid: Math.max(0, (openedMailbox.uidNext || 1) - 1),
              cutoverAt,
              updatedAt: new Date(),
            },
          },
          { upsert: true },
        );
        log('info', 'Support mailbox cutover initialised #vG2rJt', {
          uidValidity,
        });
        lock.release();
        await client.logout();
        assertHealthy();
        return done();
      }

      let lastUid = cursor.uidValidity === uidValidity ? cursor.lastUid : 0;
      let rescanThroughUid = cursor.rescanThroughUid;
      if (cursor.uidValidity !== uidValidity) {
        // UIDVALIDITY resets can follow mailbox repair. Re-scan and deduplicate
        // old UIDs while preserving the original cutover boundary.
        rescanThroughUid = Math.max(0, (openedMailbox.uidNext || 1) - 1);
        await SupportMailboxCursor.updateOne(
          { _id: 'support-inbox' },
          {
            $set: {
              uidValidity,
              lastUid: 0,
              rescanThroughUid,
              updatedAt: new Date(),
            },
          },
        );
      }

      // Finish the FETCH iterator before issuing any download commands on the
      // same connection. ImapFlow holds the command queue while yielding rows.
      const batch: FetchMessageObject[] = [];
      for await (const item of client.fetch(
        `${lastUid + 1}:*`,
        {
          uid: true,
          size: true,
          envelope: true,
          internalDate: true,
          bodyStructure: true,
          headers: [
            'AUTO-SUBMITTED',
            'CONTENT-TYPE',
            'REFERENCES',
            'IN-REPLY-TO',
          ],
        },
        { uid: true },
      )) {
        assertHealthy();
        if (item.uid <= lastUid) continue;
        batch.push(item);
        if (batch.length >= mailbox.maxMessagesPerPoll) break;
      }
      let processed = 0;
      for (const item of batch) {
        assertHealthy();
        const inboundKey =
          normaliseMessageId(item.envelope?.messageId) ||
          `imap:${uidValidity}:${item.uid}`;
        const internalDate = item.internalDate
          ? new Date(item.internalDate)
          : undefined;
        const receivedAt =
          internalDate && !Number.isNaN(internalDate.getTime())
            ? internalDate
            : undefined;
        if (
          rescanThroughUid !== undefined &&
          item.uid <= rescanThroughUid &&
          (!receivedAt || receivedAt < cursor.cutoverAt)
        ) {
          await SupportMailboxCursor.updateOne(
            { _id: 'support-inbox', uidValidity },
            {
              $max: { lastUid: item.uid },
              $set: { updatedAt: new Date() },
              ...(item.uid >= rescanThroughUid && {
                $unset: { rescanThroughUid: 1 },
              }),
            },
          );
          if (item.uid >= rescanThroughUid) rescanThroughUid = undefined;
          lastUid = item.uid;
          processed += 1;
          await touchAgendaJob(job);
          assertHealthy();
          continue;
        }
        const oversized = (item.size || 0) > mailbox.maxMessageBytes;
        let parsed: ParsedSupportMail;
        if (oversized) {
          parsed = {
            body: '',
            sender: addressFromEnvelope(item.envelope),
            subject: item.envelope?.subject,
            messageId: normaliseMessageId(item.envelope?.messageId),
            inReplyTo: normaliseMessageId(
              headerValue(item.headers, 'IN-REPLY-TO') ||
                item.envelope?.inReplyTo,
            ),
            references:
              headerValue(item.headers, 'REFERENCES')
                .match(/<[^>]+>/g)
                ?.map(reference => normaliseMessageId(reference))
                .filter((reference): reference is string =>
                  Boolean(reference),
                ) || [],
            attachments: attachmentMetadata(item.bodyStructure),
            automated:
              /^\s*auto-submitted:\s*(?!no\s*$).+/im.test(
                item.headers?.toString('utf8') || '',
              ) ||
              /multipart\/report\s*;\s*report-type\s*=\s*delivery-status/i.test(
                headerValue(item.headers, 'CONTENT-TYPE'),
              ) ||
              /^(postmaster|mailer-daemon)@/i.test(
                addressFromEnvelope(item.envelope) || '',
              ),
          };
        } else {
          const download = await client.download(item.uid, undefined, {
            uid: true,
            maxBytes: mailbox.maxMessageBytes,
          });
          if (!download.content)
            throw new Error('Support mailbox message not found');
          parsed = await parseSupportMailSource(
            download.content,
            mailbox.maxMessageBytes,
          );
        }
        assertHealthy();
        if (!parsed.automated || parsed.deliveryStatus === 'failed') {
          await processMail(
            parsed,
            item.envelope,
            receivedAt,
            inboundKey,
            oversized,
          );
        }
        await SupportMailboxCursor.updateOne(
          { _id: 'support-inbox', uidValidity },
          {
            $max: { lastUid: item.uid },
            $set: { updatedAt: new Date() },
            ...(rescanThroughUid !== undefined &&
              item.uid >= rescanThroughUid && {
                $unset: { rescanThroughUid: 1 },
              }),
          },
        );
        if (rescanThroughUid !== undefined && item.uid >= rescanThroughUid) {
          rescanThroughUid = undefined;
        }
        lastUid = item.uid;
        processed += 1;
        await touchAgendaJob(job);
        assertHealthy();
      }
      log('info', 'Support mailbox poll completed #hK4tPq', { processed });
    } finally {
      lock.release();
    }
    await client.logout();
    assertHealthy();
    return done();
  } catch (error) {
    await client.logout().catch(() => undefined);
    const mailboxError = (connectionError || error) as Error & {
      code?: unknown;
    };
    log('error', 'Support mailbox poll failed #Kc8wQm', {
      errorCode:
        typeof mailboxError.code === 'string'
          ? mailboxError.code.slice(0, 50)
          : 'mailbox_error',
    });
    return done(mailboxError);
  } finally {
    heartbeat.stop();
  }
}

export default pollSupportMailbox;
