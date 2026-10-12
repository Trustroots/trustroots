import type {
  MessagePayload,
  MessageThreadSummary,
  PreviewMessageRequest,
  SendMessageRequest,
} from '@/modules/messages/shared/messages';

const request: SendMessageRequest = {
  userTo: 'recipient-id',
  content: 'A fictional message',
  read: false,
};
const preview: PreviewMessageRequest = { content: 'A fictional draft' };
const message: MessagePayload = {
  _id: 'message-id',
  content: 'A fictional message',
  created: '2026-01-02T03:04:05.000Z',
  read: false,
  userFrom: { _id: 'sender-id', username: 'sample-sender' },
  userTo: { _id: 'recipient-id', username: 'sample-recipient' },
};
const thread: MessageThreadSummary = {
  _id: 'thread-id',
  read: false,
  updated: '2026-01-02T03:04:05.000Z',
  userFrom: { _id: 'sender-id' },
  userTo: { _id: 'recipient-id' },
  message: { excerpt: 'A fictional excerpt' },
};

void [request, preview, message, thread];

// @ts-expect-error Message recipients are string identifiers.
const invalidRequest: SendMessageRequest = { userTo: 123, content: 'Hello' };
// @ts-expect-error Server-only spam metadata is not part of an API message.
const spam: boolean = message.spam;
void [invalidRequest, spam];
