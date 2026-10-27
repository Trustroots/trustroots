import mongoose, { type Types } from 'mongoose';
import type { SupportMessageRecord } from '../models/support-message.server.model.mts';
import type { SupportRequestRecord } from '../models/support.server.model.mts';

type OutboundActivityMessage = Pick<
  SupportMessageRecord,
  | 'request'
  | 'kind'
  | 'deliveryState'
  | 'acceptedAt'
  | 'requestRevision'
  | 'requestActivityAt'
  | 'activityAppliedAt'
> & { _id: Types.ObjectId };
type RequestForActivity = Pick<
  SupportRequestRecord,
  'lastActivityAt' | 'status' | 'statusChangedAt' | 'statusRevision'
> & { _id: Types.ObjectId };

const SupportMessage =
  mongoose.model<OutboundActivityMessage>('SupportMessage');
const SupportRequest = mongoose.model<RequestForActivity>('SupportRequest');

function sameDate(
  left: Date | null | undefined,
  right: Date | null | undefined,
) {
  return (left?.getTime() ?? null) === (right?.getTime() ?? null);
}

async function markActivity(
  message: OutboundActivityMessage,
  postApplyRevision?: number,
) {
  await SupportMessage.updateOne(
    {
      _id: message._id,
      deliveryState: 'accepted',
      activityAppliedAt: { $exists: false },
    },
    {
      $set: {
        activityAppliedAt: new Date(),
        ...(postApplyRevision !== undefined && {
          requestRevision: postApplyRevision,
        }),
      },
    },
  );
}

/** Apply request activity for an accepted outbound email at most once. */
export async function applySupportOutboundActivity(
  messageId: string | Types.ObjectId,
) {
  const message = await SupportMessage.findById(messageId).lean();
  if (
    !message ||
    message.deliveryState !== 'accepted' ||
    message.activityAppliedAt ||
    !message.acceptedAt
  )
    return;

  const requestRevision = message.requestRevision;
  if (requestRevision === undefined) {
    await markActivity(message);
    return;
  }

  const request = await SupportRequest.findById(message.request).lean();
  if (!request) {
    await markActivity(message);
    return;
  }

  // A request writer may have committed the CAS but lost its response. Treat
  // this exact revision/timestamp pair as our prior successful application.
  if (
    request.statusRevision === requestRevision + 1 &&
    sameDate(request.lastActivityAt, message.acceptedAt)
  ) {
    await markActivity(message, requestRevision + 1);
    return;
  }

  if (
    request.statusRevision !== requestRevision ||
    !sameDate(request.lastActivityAt, message.requestActivityAt)
  ) {
    // Newer request activity won the revision CAS. Record the skip so recovery
    // does not keep trying to apply this older email over that activity.
    await markActivity(message);
    return;
  }

  const acceptedAt = message.acceptedAt;
  const update = await SupportRequest.updateOne(
    {
      _id: request._id,
      statusRevision: requestRevision,
      lastActivityAt: message.requestActivityAt ?? null,
    },
    {
      $set: {
        lastActivityAt: acceptedAt,
        ...(message.kind === 'reply' && {
          status: 'pending',
          ...(request.status !== 'pending' && {
            statusChangedAt: acceptedAt,
          }),
          resolvedAt: null,
          resolvedBy: null,
        }),
      },
      $inc: { statusRevision: 1 },
    },
  );
  if (update.modifiedCount) {
    await markActivity(message, requestRevision + 1);
    return;
  }

  // A competing writer may have won between the read and CAS. Re-read once
  // to distinguish a lost acknowledgement of our write from newer activity.
  const latest = await SupportRequest.findById(request._id).lean();
  if (
    latest?.statusRevision === requestRevision + 1 &&
    sameDate(latest.lastActivityAt, acceptedAt)
  ) {
    await markActivity(message, requestRevision + 1);
  } else {
    await markActivity(message);
  }
}
