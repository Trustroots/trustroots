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
        return res.json(await events(req.query.date));
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
