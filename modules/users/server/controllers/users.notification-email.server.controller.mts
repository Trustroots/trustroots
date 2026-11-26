import type { Request, Response } from 'express';
import { tokenPattern } from '../../../core/server/services/notification-email-envelope.server.service.mts';
import { confirmUnsubscribe } from '../services/notification-email.server.service.mts';

type UnsubscribeRequest = Request<{ token: string }>;

function page(res: Response, status: number, content: string) {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'strict-origin');
  return res
    .status(status)
    .type('html')
    .send(
      '<!doctype html><html lang="en"><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1">' +
        '<title>Email preferences · Trustroots</title>' +
        '<main><h1>Email preferences</h1>' +
        content +
        '</main></html>',
    );
}

function invalidLink(res: Response) {
  return page(
    res,
    400,
    '<p>This unsubscribe link is invalid. You can change your email preferences in Account settings.</p>',
  );
}

export function showUnsubscribe(req: UnsubscribeRequest, res: Response) {
  const token = tokenPattern.exec(req.params.token);
  if (!token) return invalidLink(res);
  const category =
    token[2] === 'hosting' ? 'hosting reminders' : 'unread-message emails';
  return page(
    res,
    200,
    '<p>Stop receiving ' +
      category +
      ' from Trustroots?</p>' +
      '<form method="post"><button type="submit">Unsubscribe</button></form>',
  );
}

export async function unsubscribe(req: UnsubscribeRequest, res: Response) {
  if (!(await confirmUnsubscribe(req.params.token))) return invalidLink(res);
  return page(
    res,
    200,
    '<p>You have unsubscribed. You can change your email preferences in Account settings.</p>',
  );
}
