/** Minimal public identity used beside a message or in an inbox thread. */
export interface MessageMember<Id = string> {
  _id: Id;
  updated?: string;
  displayName?: string;
  username?: string;
  avatarSource?: string;
  avatarUploaded?: boolean;
  avatarVersion?: string;
  emailHash?: string;
  additionalProvidersData?: {
    facebook?: { id?: string };
  };
}

export type MessageParticipant<Id = string> =
  MessageMember<Id> | { _id: Id } | null;

/** POST /api/messages request. The server ignores `read`; the client sends false. */
export interface SendMessageRequest {
  userTo: string;
  content: string;
  read?: false;
}

export interface MarkMessagesReadRequest {
  messageIds: string[];
}

export interface PreviewMessageRequest {
  content: string;
}

export interface MessagePayload<
  Id = string,
  Timestamp = string,
  Member = MessageMember<Id> | null,
> {
  _id: Id;
  content: string;
  created: Timestamp;
  read: boolean;
  userFrom: Member;
  userTo: Member;
}

/** Inbox message preview omits content and spam metadata. */
export interface MessageThreadSummary<Id = string, Timestamp = string> {
  _id: Id;
  read: boolean;
  updated: Timestamp;
  userFrom: MessageParticipant<Id>;
  userTo: MessageParticipant<Id>;
  message: { excerpt: string };
}

export interface PreviewMessageResponse {
  content: string;
}

export interface UnreadMessageCountResponse {
  unread: number;
}

export interface ConversationCounts extends UnreadMessageCountResponse {
  all: number;
  unreplied: number;
}

export type MarkMessagesReadResponse = Record<string, never>;
