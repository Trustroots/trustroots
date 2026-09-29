import type { UserProfile, UserSummary } from '@/modules/users/client/types';

export interface ContactRecord {
  _id?: string;
  userFrom?: string | UserSummary;
  userTo?: string | UserSummary;
  confirmed?: boolean;
  created?: string;
  message?: string;
  $resolved?: boolean;
  user?: UserProfile;
}

export interface ContactListEntry extends ContactRecord {
  _id: string;
  confirmed: boolean;
  created: string;
  user: UserProfile;
}

export type ContactList = ContactListEntry[] & { $resolved: boolean };

export interface ContactConfirmation
  extends Omit<ContactRecord, 'userFrom' | 'userTo'> {
  userFrom: UserProfile;
  userTo: UserProfile;
}
