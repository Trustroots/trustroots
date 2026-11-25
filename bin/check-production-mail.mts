import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { ImapFlow } from 'imapflow';
import { MongoBackend } from '@agendajs/mongo-backend';
import { Agenda } from 'agenda';
import { MongoClient, MongoServerError, type Db } from 'mongodb';
import nodemailer from 'nodemailer';
import config, { mailMode } from '../config/config.mts';
import { isCanonicalProductionMailDomain } from '../config/lib/mail-safety.mts';
import { MailDeliveryError } from '../config/lib/mail-delivery-error.mts';
import {
  inspectMailQueue,
  sendEmailJobName,
} from '../config/lib/mail-queue.mts';
import type { RenderedEmail } from '../modules/core/server/services/email.server.service.mts';

const production =
  process.env.NODE_ENV === 'production' &&
  (process.env.TRUSTROOTS_DEPLOYMENT_TIER ?? 'production') === 'production' &&
  isCanonicalProductionMailDomain(config.domain);

const canaryDeadlineMs = 5 * 60_000;
const canarySpacingMs = 10 * 60_000;

function report(outcome: string, details: object = {}, failed = false) {
  console.info(JSON.stringify({ mailMode, outcome, ...details }));
  if (failed) process.exitCode = 1;
}

async function verify() {
  const options = config.mailer.options;
  const smtpUser =
    options.auth?.user || (options.url && new URL(options.url).username);
  const transport = nodemailer.createTransport({
    ...options,
    ...(smtpUser ? { forceAuth: true } : {}),
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
    logger: false,
    debug: false,
    transactionLog: false,
  });
  try {
    await transport.verify();
    report('smtp_verified');
  } catch (error) {
    const failure = new MailDeliveryError(error);
    report(
      'smtp_verification_failed',
      { reason: failure.message, responseCode: failure.responseCode },
      true,
    );
  } finally {
    transport.close();
  }
}

async function queue(db: Db) {
  const metrics = await inspectMailQueue(db.collection('agendaJobs'));
  const alerts: string[] = [];
  if (!metrics.workerHealthy) alerts.push('worker_stalled');
  if (metrics.stalledAttempts) alerts.push('processing_stalled');
  if (metrics.oldestDueSeconds >= 120) alerts.push('queue_age');
  if (metrics.exhausted) alerts.push('retries_exhausted');
  if (metrics.authenticationOrConfiguration) alerts.push('smtp_configuration');
  if (mailMode !== 'live') alerts.push('unexpected_mail_mode');
  report('queue_status', { ...metrics, alerts }, alerts.length > 0);
}

async function canary(db: Db) {
  const recipient = process.env.TRUSTROOTS_MAIL_CANARY_ADDRESS;
  const host = process.env.TRUSTROOTS_MAIL_CANARY_IMAP_HOST;
  const user = process.env.TRUSTROOTS_MAIL_CANARY_IMAP_USER;
  const pass = process.env.TRUSTROOTS_MAIL_CANARY_IMAP_PASSWORD;
  if (
    !recipient ||
    !/^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(recipient) ||
    [config.supportEmail, config.mailer.from].some(
      address => address.toLowerCase() === recipient.toLowerCase(),
    ) ||
    !host ||
    !user ||
    !pass
  ) {
    report('canary_configuration_invalid', {}, true);
    return;
  }

  const id = randomUUID();
  const now = Date.now();
  const deadline = new Date(now + canaryDeadlineMs);
  const checks = db.collection<{ _id: string; nextAllowedAt: Date }>(
    'productionMailChecks',
  );
  try {
    await checks.updateOne(
      { _id: 'inbox-canary', nextAllowedAt: { $lte: new Date(now) } },
      { $set: { nextAllowedAt: new Date(now + canarySpacingMs) } },
      { upsert: true },
    );
  } catch (error) {
    if (!(error instanceof MongoServerError) || error.code !== 11000)
      throw error;
    report('canary_rate_limited');
    return;
  }

  const backend = new MongoBackend({
    mongo: db,
    collection: 'agendaJobs',
    ensureIndex: false,
  });
  const agenda = new Agenda({ backend });
  const subject = 'Trustroots delivery canary ' + id;
  try {
    await agenda.now<RenderedEmail>(sendEmailJobName, {
      to: { address: recipient },
      from: config.mailer.from,
      subject,
      text: 'Trustroots production email delivery test.',
      deliveryDeadline: deadline,
    });
  } finally {
    await backend.disconnect();
  }

  const mailbox = new ImapFlow({
    host,
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  mailbox.on('error', () => mailbox.close());
  const timer = setTimeout(
    () => mailbox.close(),
    deadline.getTime() - Date.now(),
  );
  try {
    await mailbox.connect();
    await mailbox.mailboxOpen('INBOX', { readOnly: true });
    while (Date.now() < deadline.getTime()) {
      const matches = await mailbox.search({ subject });
      if (matches && matches.length && Date.now() < deadline.getTime()) {
        report('canary_received', { canaryId: id });
        return;
      }
      await delay(Math.min(5000, Math.max(0, deadline.getTime() - Date.now())));
    }
    report('canary_receipt_missing', { canaryId: id }, true);
  } catch {
    report('canary_mailbox_check_failed', { canaryId: id }, true);
  } finally {
    clearTimeout(timer);
    mailbox.close();
  }
}

async function main() {
  const action = process.argv[2];
  if (!production || !['verify', 'queue', 'canary'].includes(action)) {
    report('production_mail_check_unavailable', {}, true);
    return;
  }
  if (action !== 'queue' && mailMode !== 'live') {
    report('unexpected_mail_mode', {}, true);
    return;
  }
  if (action === 'verify') return verify();

  const client = new MongoClient(config.db.uri, {
    serverSelectionTimeoutMS: 5000,
    timeoutMS: 10_000,
  });
  try {
    const db = client.db();
    if (action === 'queue') await queue(db);
    else await canary(db);
  } finally {
    await client.close();
  }
}

main().catch(() => report('production_mail_check_failed', {}, true));
