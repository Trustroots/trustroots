import type { Types } from 'mongoose';

export type AdminId = Types.ObjectId;

export interface AdminUserRecord {
  username: string;
  email: string;
  displayName?: string;
  roles: string[];
  member: Array<{ tribe?: Types.ObjectId | null }>;
}

export interface AdminMessageRecord {
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
  content: string;
}

export interface AdminThreadRecord {
  message: Types.ObjectId;
}

export interface AdminReferenceThreadRecord {
  reference: string;
  thread: Types.ObjectId;
}
