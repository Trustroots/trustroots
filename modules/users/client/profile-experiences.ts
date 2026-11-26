import type { ComponentType } from 'react';
import type { UserProfile } from './types';

export type ExperienceAction = { href: string; label: string };

type ReplyRecipient<AuthoredExperience> = Pick<
  UserProfile,
  '_id' | 'username' | 'displayName'
> & { ownExperience?: AuthoredExperience };

export type ReadReplyRecipient<AuthoredExperience> = (
  username: string,
) => Promise<ReplyRecipient<AuthoredExperience>>;

export interface ProfileExperiences<AuthoredExperience> {
  readReplyRecipient: ReadReplyRecipient<AuthoredExperience>;
  readAuthoredExperienceId: (
    memberId: string,
    authorId: string,
  ) => Promise<string | null>;
  getCount: (
    userId: string,
  ) => Promise<{ count: number; hasPending?: boolean }>;
  Create: ComponentType<{ userFrom: UserProfile; userTo: UserProfile }>;
  List: ComponentType<{
    authenticatedUser: UserProfile;
    profile: UserProfile;
    experienceAction?: ExperienceAction;
  }>;
  PendingAuthored: ComponentType<{ userId: string }>;
  Authored: ComponentType<{
    experience: AuthoredExperience;
    author: UserProfile;
    recipient: UserProfile;
  }>;
}
