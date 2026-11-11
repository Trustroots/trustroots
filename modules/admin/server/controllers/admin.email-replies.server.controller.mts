import type { Request, Response } from 'express';
import config from '../../../../config/config.mts';
import {
  extractReplyText,
  maxReplyBytes,
} from '../../../messages/server/services/message-email-reply.server.service.mts';
import {
  fetchReplyEmails,
  type ReplyEmail,
} from '../../../messages/server/services/message-reply-jmap.server.service.mts';
import type { EmailReplyPreview } from '../../shared/email-replies.ts';

function redact(value: string, accessToken: string): string {
  return value
    .replaceAll(accessToken, '[redacted]')
    .replace(/\+[^@\s<>"']+(?=@)/g, '+[redacted]');
}

function preview(mail: ReplyEmail, accessToken: string): EmailReplyPreview {
  const extracted = extractReplyText(mail.text);
  let parseResult: EmailReplyPreview['parseResult'] = 'Extracted';
  if (
    mail.autoSubmitted != null &&
    mail.autoSubmitted.trim().toLowerCase() !== 'no'
  ) {
    parseResult = 'Automated';
  } else if (mail.truncated) {
    parseResult = 'Incomplete';
  } else if (Buffer.byteLength(mail.text) > maxReplyBytes) {
    parseResult = 'Too large';
  } else if (!extracted) {
    parseResult = 'Empty';
  }

  const origin = `${config.https ? 'https' : 'http'}://${config.domain}`;
  const candidates = new Set<string>();
  for (const link of mail.text.matchAll(/https?:\/\/[^\s<>"']+/g)) {
    const url = URL.parse(link[0]);
    if (url?.origin !== origin) continue;
    const username = /^\/messages\/([a-z\d_-]+)\/?$/i.exec(url.pathname)?.[1];
    if (username) candidates.add(username);
  }
  const matching =
    candidates.size > 1
      ? 'ambiguous'
      : candidates.size === 1
        ? 'candidate'
        : 'unmatched';
  return {
    id: redact(mail.id, accessToken),
    sender: redact(mail.from.join(', '), accessToken),
    recipients: mail.to.map(address => redact(address, accessToken)),
    matching,
    candidates: [...candidates].map(username => redact(username, accessToken)),
    parseResult,
    extractedText: redact(extracted, accessToken).slice(0, maxReplyBytes),
    sourceText: redact(mail.text, accessToken).slice(0, maxReplyBytes),
  };
}

export async function previewEmailReplies(_req: Request, res: Response) {
  res.set('Cache-Control', 'no-store');
  const sessionUrl = process.env.TRUSTROOTS_EMAIL_REPLIES_JMAP_SESSION_URL;
  const accessToken = process.env.TRUSTROOTS_EMAIL_REPLIES_JMAP_ACCESS_TOKEN;
  const accountId = process.env.TRUSTROOTS_EMAIL_REPLIES_JMAP_ACCOUNT_ID;
  const mailboxId = process.env.TRUSTROOTS_EMAIL_REPLIES_JMAP_MAILBOX_ID;
  if (!sessionUrl || !accessToken || !accountId || !mailboxId) {
    return res.json({ status: 'unconfigured' });
  }

  try {
    const emails = await fetchReplyEmails({
      sessionUrl,
      accessToken,
      accountId,
      mailboxId,
    });
    return res.json({
      status: 'preview',
      checkedAt: new Date().toISOString(),
      replies: emails.map(mail => preview(mail, accessToken)),
    });
  } catch {
    return res
      .status(503)
      .json({ message: 'Could not read the reply mailbox.' });
  }
}
