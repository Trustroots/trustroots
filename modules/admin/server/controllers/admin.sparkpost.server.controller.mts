import {
  recoveryDay,
  recoveryAccounts,
  queueRecovery,
} from '../services/email-recovery.server.service.mts';
import type { Request, Response } from 'express';
import {
  DiagnosticInputError,
  events,
  overview,
  period,
  preview,
} from '../services/sparkpost.server.service.mts';

export async function diagnostics(req: Request, res: Response) {
  res.set('Cache-Control', 'no-store');
  try {
    switch (req.params.action) {
      case 'overview':
        return res.json(await overview(period(req.query.days)));
      case 'events':
        return res.json(
          await events(req.query.date, new Date(), req.query.cursor),
        );
      case 'accounts':
        return res.json(
          await recoveryAccounts(req.query.from, req.query.to, req.query.page),
        );
      case 'recovery':
        return res.json(await recoveryDay(req.query.date, req.query.page));
      case 'preview':
        return res.json(await preview(req.query.from, req.query.to));
      default:
        return res.status(404).json({ message: 'Unknown email diagnostic.' });
    }
  } catch (error) {
    return res.status(error instanceof DiagnosticInputError ? 400 : 503).json({
      message:
        error instanceof DiagnosticInputError
          ? error.message
          : 'Email diagnostics are unavailable. Check the database and SparkPost configuration.',
    });
  }
}

export async function recover(
  req: Request & {
    user?: { _id: import('mongoose').Types.ObjectId; roles: string[] };
  },
  res: Response,
) {
  res.set('Cache-Control', 'no-store');
  if (!req.user || !req.user.roles.includes('admin'))
    return res.status(403).json({ message: 'Administrator access required.' });
  try {
    return res.json({
      results: await queueRecovery(
        req.body?.date,
        req.body?.keys,
        req.user._id,
      ),
    });
  } catch (error) {
    return res.status(error instanceof DiagnosticInputError ? 400 : 503).json({
      message:
        error instanceof DiagnosticInputError
          ? error.message
          : 'Recovery could not be completed. Inspect results before retrying.',
    });
  }
}
