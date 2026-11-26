import type { ComponentType } from 'react';
import type { UserProfile, UserSummary } from './types';

export interface ProfileContact {
  _id?: string;
  userFrom?: string | UserSummary;
  userTo?: string | UserSummary;
  confirmed?: boolean;
  created?: string;
}

export interface ProfileContactEntry extends ProfileContact {
  _id: string;
  confirmed: boolean;
  created: string;
  user: UserProfile;
}

export type ProfileContactList = ProfileContactEntry[] & { $resolved: boolean };

export interface ProfileContacts {
  list: (memberId: string) => Promise<ProfileContactEntry[]>;
  getByUserId: (memberId: string) => Promise<ProfileContact | null>;
  Common: ComponentType<{ profileId: string }>;
  List: ComponentType<{
    appUser: UserProfile;
    contacts: ProfileContactList;
    onContactRemoved: (contact: ProfileContact) => void;
    loadFailed: boolean;
    onRetry: () => void;
  }>;
  Remove: ComponentType<{
    selfId: string;
    contact: ProfileContact & { _id: string };
    show: boolean;
    onSuccess: () => void;
    onCancel: () => void;
  }>;
}
