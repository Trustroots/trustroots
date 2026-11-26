import type { Types } from 'mongoose';

export interface ExportContactsRequest {
  user: { _id: Types.ObjectId };
  contacts?: Array<{
    _id?: Types.ObjectId;
    confirmed?: boolean;
    created?: Date;
    userFrom?: Types.ObjectId;
    userTo?: Types.ObjectId;
    user: { _id: Types.ObjectId; username?: string; displayName?: string };
  }>;
}

export interface ExportContactsResponse {
  status(code: number): ExportContactsResponse;
  send(body: unknown): ExportContactsResponse;
  json(body: unknown): ExportContactsResponse;
}

export type LoadExportContacts = (
  req: ExportContactsRequest,
  res: ExportContactsResponse,
  next: (error?: unknown) => unknown,
  userId: Types.ObjectId,
) => unknown;

export type RemovePendingContacts = (
  first: Types.ObjectId,
  second: Types.ObjectId,
) => Promise<void>;
