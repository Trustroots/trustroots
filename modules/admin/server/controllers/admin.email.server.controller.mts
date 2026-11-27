import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import log from '@trustroots/logger';
import { mailMode } from '../../../../config/config.mts';
import { inspectMailQueue } from '../../../../config/lib/mail-queue.mts';
import type { EmailQueueSnapshot } from '../../shared/email-queue.mts';

export async function queueHealth(_req: Request, res: Response) {
  res.set('Cache-Control', 'no-store');

  try {
    const db = mongoose.connection.db;
    if (db) {
      const capturedAt = new Date();
      const metrics = await inspectMailQueue(
        db.collection('agendaJobs'),
        capturedAt,
        // Stryker disable next-line ObjectLiteral: the suite never waits long enough for the queue inspect deadline to matter
        { timeoutMS: 5_000 },
      );
      return res.json({
        capturedAt: capturedAt.toISOString(),
        mailMode,
        ...metrics,
      } satisfies EmailQueueSnapshot);
    }
  } catch {
    log('error', 'Could not inspect email queue');
  }

  return res
    .status(503)
    .json({ message: 'Email queue health is unavailable.' });
}
