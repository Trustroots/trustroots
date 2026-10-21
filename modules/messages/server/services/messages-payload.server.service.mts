import type {
  MarkMessagesReadResponse,
  MessagePayload,
  MessageThreadSummary,
  PreviewMessageResponse,
  SendMessageRequest,
  HostingDetails,
  UnreadMessageCountResponse,
} from '../../shared/messages.js';

export interface MessageReadSelector<Id> {
  $or: { _id: string; userTo: Id }[];
}

/** Build persisted fields from a request that passed controller validation. */
export function prepareNewMessageFields<Id>(
  body: SendMessageRequest,
  userFrom: Id,
): {
  userTo: string;
  content: string;
  userFrom: Id;
  hostingDetails?: HostingDetails;
} {
  return {
    userTo: body.userTo,
    content: body.content,
    userFrom,
    ...(body.hostingDetails === undefined
      ? {}
      : { hostingDetails: body.hostingDetails }),
  };
}

/** Select only the fields exposed by the send and thread message endpoints. */
export function prepareMessageForClient<Id, Timestamp, Member>(
  message: MessagePayload<Id, Timestamp, Member>,
): MessagePayload<Id, Timestamp, Member> {
  return {
    _id: message._id,
    content: message.content,
    created: message.created,
    read: message.read,
    userFrom: message.userFrom,
    userTo: message.userTo,
    ...(message.hostingDetails === undefined
      ? {}
      : {
          hostingDetails: {
            guests: message.hostingDetails.guests,
            ...(message.hostingDetails.arrival === undefined
              ? {}
              : {
                  arrival: message.hostingDetails.arrival,
                  departure: message.hostingDetails.departure,
                }),
          },
        }),
  };
}

/** Select inbox fields after its excerpt and sender read state are prepared. */
export function prepareThreadSummary<Id, Timestamp>(
  thread: Pick<
    MessageThreadSummary<Id, Timestamp>,
    '_id' | 'read' | 'updated' | 'userFrom' | 'userTo'
  >,
  excerpt: string,
): MessageThreadSummary<Id, Timestamp> {
  return {
    _id: thread._id,
    read: thread.read,
    updated: thread.updated,
    userFrom: thread.userFrom,
    userTo: thread.userTo,
    message: { excerpt },
  };
}

/** Keep message read updates scoped to the authenticated recipient. */
export function prepareMarkReadSelector<Id>(
  messageIds: string[],
  userTo: Id,
): MessageReadSelector<Id> {
  return { $or: messageIds.map(_id => ({ _id, userTo })) };
}

export function prepareUnreadMessageCount(
  unread: number,
): UnreadMessageCountResponse {
  return { unread: unread ? Number.parseInt(String(unread), 10) : 0 };
}

export function prepareMarkReadResponse(): MarkMessagesReadResponse {
  return {};
}

export function preparePreviewMessageResponse(
  content: string,
): PreviewMessageResponse {
  return { content };
}
