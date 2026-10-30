import type { Job } from 'agenda';
import mongoose from 'mongoose';
import config from '../../../../config/config.mts';
import { applySupportOutboundActivity } from '../services/support-outbound-activity.server.service.mts';
import type { SupportMessageRecord } from '../models/support-message.server.model.mts';

type Done = (error?: Error | null) => void;
const SupportMessage = mongoose.model<SupportMessageRecord>('SupportMessage');

export async function recoverSupportMessages(
  _job: Pick<Job, 'attrs'>,
  done: Done,
) {
  if (!config.supportInbox.enabled) return done();
  const staleSending = new Date(Date.now() - 10 * 60 * 1000);
  const queuedBefore = new Date(Date.now() - 60 * 1000);
  try {
    const acceptedWithoutActivity = await SupportMessage.find({
      direction: 'outbound',
      deliveryState: 'accepted',
      activityAppliedAt: { $exists: false },
    })
      .select('_id')
      .limit(100)
      .lean();
    for (const message of acceptedWithoutActivity) {
      await applySupportOutboundActivity(message._id);
    }

    await SupportMessage.updateMany(
      { deliveryState: 'sending', lastAttemptAt: { $lt: staleSending } },
      { $set: { deliveryState: 'uncertain', errorCode: 'worker_interrupted' } },
    );
    await SupportMessage.updateMany(
      {
        direction: 'outbound',
        kind: 'acknowledgement',
        deliveryState: 'failed',
        errorCode: 'queue_failed',
        createdAt: { $lt: queuedBefore },
      },
      {
        $set: { deliveryState: 'queued' },
        $unset: { errorCode: 1 },
      },
    );
    const pending = await SupportMessage.find({
      deliveryState: 'queued',
      createdAt: { $lt: queuedBefore },
    })
      .select('_id')
      .limit(100)
      .lean();
    const agendaModule = await import('../../../../config/lib/agenda.mjs');
    const agenda = agendaModule.default as import('agenda').Agenda;
    await Promise.all(
      pending.map(message => {
        const messageId = String(message._id);
        return (
          agenda
            .create('send support message', { messageId })
            // Agenda 6 stores unfinished processor state as null; MongoDB's
            // null match includes legacy documents where the field is absent.
            // Completed history must not block re-enqueue after a lost send.
            .unique(
              {
                'data.messageId': messageId,
                lastFinishedAt: null,
              },
              { insertOnly: true },
            )
            .save()
        );
      }),
    );
    return done();
  } catch (error) {
    return done(error as Error);
  }
}
