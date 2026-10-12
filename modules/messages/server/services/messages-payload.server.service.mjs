/**
 * @template Id
 * @typedef {{ $or: { _id: string, userTo: Id }[] }} MessageReadSelector
 */

/** Build the persisted fields from a request that passed controller validation. */
/**
 * @template Id
 * @param {import('../../shared/messages.js').SendMessageRequest} body
 * @param {Id} userFrom
 * @returns {{ userTo: string, content: string, userFrom: Id }}
 */
export function prepareNewMessageFields(body, userFrom) {
  return { userTo: body.userTo, content: body.content, userFrom };
}

/** Select only the fields exposed by the send and thread message endpoints. */
/**
 * @template Id, Timestamp, Member
 * @param {import('../../shared/messages.js').MessagePayload<Id, Timestamp, Member>} message
 * @returns {import('../../shared/messages.js').MessagePayload<Id, Timestamp, Member>}
 */
export function prepareMessageForClient(message) {
  return {
    _id: message._id,
    content: message.content,
    created: message.created,
    read: message.read,
    userFrom: message.userFrom,
    userTo: message.userTo,
  };
}

/** Select the inbox fields after its excerpt and sender read state are prepared. */
/**
 * @template Id, Timestamp
 * @param {Pick<import('../../shared/messages.js').MessageThreadSummary<Id, Timestamp>, '_id' | 'read' | 'updated' | 'userFrom' | 'userTo'>} thread
 * @param {string} excerpt
 * @returns {import('../../shared/messages.js').MessageThreadSummary<Id, Timestamp>}
 */
export function prepareThreadSummary(thread, excerpt) {
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
/**
 * @template Id
 * @param {string[]} messageIds
 * @param {Id} userTo
 * @returns {MessageReadSelector<Id>}
 */
export function prepareMarkReadSelector(messageIds, userTo) {
  return { $or: messageIds.map(_id => ({ _id, userTo })) };
}

/**
 * @param {number} unread
 * @returns {import('../../shared/messages.js').UnreadMessageCountResponse}
 */
export function prepareUnreadMessageCount(unread) {
  return { unread: unread ? Number.parseInt(String(unread), 10) : 0 };
}

/**
 * @returns {import('../../shared/messages.js').MarkMessagesReadResponse}
 */
export function prepareMarkReadResponse() {
  return {};
}

/**
 * @param {string} content
 * @returns {import('../../shared/messages.js').PreviewMessageResponse}
 */
export function preparePreviewMessageResponse(content) {
  return { content };
}
