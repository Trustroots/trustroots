import type { ContactRecord } from '../types';
import type {
  ExperienceMine,
  ExperienceInteractions,
  ExperienceRecommendation,
} from '@/modules/experiences/shared/experience';

export function memberId(
  member?: string | { _id: string },
): string | undefined {
  return typeof member === 'string' ? member : member?._id;
}

export function contactState(contact: ContactRecord | null, viewerId: string) {
  if (!contact) return 'absent';
  if (contact.confirmed) return 'confirmed';
  return memberId(contact.userFrom) === viewerId ? 'outgoing' : 'incoming';
}

export interface ConnectionAccount {
  id: string;
  authorId: string;
  public?: boolean;
  interactions?: Partial<ExperienceInteractions>;
  recommend?: ExperienceRecommendation;
  feedbackPublic?: string;
}

/** Preserve API omissions; reciprocal responses have no publication field. */
export function connectionAccounts(
  experience: ExperienceMine | null,
  viewerId: string,
  otherId: string,
): { yours: ConnectionAccount | null; theirs: ConnectionAccount | null } {
  const empty = { yours: null, theirs: null };
  if (!experience) return empty;
  const authorId = memberId(experience.userFrom);
  const recipientId = memberId(experience.userTo);
  if (!(
    (authorId === viewerId && recipientId === otherId) ||
    (authorId === otherId && recipientId === viewerId)
  ))
    return empty;
  const primary: ConnectionAccount = {
    id: experience._id,
    authorId,
    public: experience.public,
    interactions: experience.interactions,
    recommend: experience.recommend,
    feedbackPublic: experience.feedbackPublic,
  };
  const response: ConnectionAccount | null = experience.response
    ? {
        id: experience.response._id,
        authorId: recipientId,
        interactions: experience.response.interactions,
        recommend: experience.response.recommend,
        feedbackPublic: experience.response.feedbackPublic,
      }
    : null;
  return authorId === viewerId
    ? { yours: primary, theirs: response }
    : { yours: response, theirs: primary };
}
