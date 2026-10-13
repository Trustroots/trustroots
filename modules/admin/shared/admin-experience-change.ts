export type AdminExperienceRecommendation = 'yes' | 'no' | 'unknown';

export interface AdminExperienceInteractions {
  met: boolean;
  guest: boolean;
  host: boolean;
}

export interface AdminExperienceChangeMember {
  _id: string;
  username?: string;
  displayName?: string;
}

export type AdminExperienceChangeParticipant =
  AdminExperienceChangeMember | string | null;

interface AdminExperienceChangeExperienceFields {
  _id: string;
  public: boolean;
  recommend: AdminExperienceRecommendation;
  interactions?: AdminExperienceInteractions;
  feedbackPublic?: string;
}

/** The admin lookup populates both members. */
export interface AdminExperienceChangeSearchExperience extends AdminExperienceChangeExperienceFields {
  userFrom: AdminExperienceChangeMember | null;
  userTo: AdminExperienceChangeMember | null;
}

/** The queue populates the Experience, but leaves its member IDs unpopulated. */
export interface AdminExperienceChangeQueuedExperience extends AdminExperienceChangeExperienceFields {
  userFrom: string;
  userTo: string;
}

export interface AdminExperienceChangeProposal {
  feedbackPublic: string;
  recommend: AdminExperienceRecommendation;
  interactions: AdminExperienceInteractions;
}

interface AdminExperienceChangeRequestBase {
  _id: string;
  requester: AdminExperienceChangeMember | null;
  experience: AdminExperienceChangeQueuedExperience | null;
  status: 'pending' | 'processing';
}

export type AdminExperienceChangeRequest =
  | (AdminExperienceChangeRequestBase & {
      kind: 'edit';
      proposed: AdminExperienceChangeProposal;
    })
  | (AdminExperienceChangeRequestBase & { kind: 'remove' });

export type AdminExperienceChangeDecision = 'approve' | 'reject';

export interface AdminExperienceChangeLink {
  path: string;
  expiresAt: string;
}

export interface AdminExperienceChangeDecisionResult {
  _id: string;
  status: 'approved' | 'rejected';
}
