export type AdminExperienceRecommendation = 'yes' | 'no' | 'unknown';

export interface AdminExperienceInteractions {
  met: boolean;
  guest: boolean;
  host: boolean;
}

export interface AdminExperienceChangeMember<Id = string> {
  _id: Id;
  username?: string;
  displayName?: string;
}

export type AdminExperienceChangeParticipant<Id = string> =
  AdminExperienceChangeMember<Id> | Id | null;

interface AdminExperienceChangeExperienceFields<
  Id = string,
  Timestamp = string,
> {
  _id: Id;
  created: Timestamp;
  public: boolean;
  recommend: AdminExperienceRecommendation;
  interactions?: AdminExperienceInteractions;
  feedbackPublic?: string;
}

/** The admin lookup populates both members. */
export interface AdminExperienceChangeSearchExperience<
  Id = string,
  Timestamp = string,
> extends AdminExperienceChangeExperienceFields<Id, Timestamp> {
  userFrom: AdminExperienceChangeMember<Id> | null;
  userTo: AdminExperienceChangeMember<Id> | null;
}

/** The queue populates the Experience, but leaves its member IDs unpopulated. */
export interface AdminExperienceChangeQueuedExperience<
  Id = string,
  Timestamp = string,
> extends AdminExperienceChangeExperienceFields<Id, Timestamp> {
  userFrom: Id;
  userTo: Id;
}

export interface AdminExperienceChangeProposal {
  feedbackPublic: string;
  recommend: AdminExperienceRecommendation;
  interactions: AdminExperienceInteractions;
}

interface AdminExperienceChangeRequestBase<Id = string, Timestamp = string> {
  _id: Id;
  requester: AdminExperienceChangeMember<Id> | null;
  experience: AdminExperienceChangeQueuedExperience<Id, Timestamp> | null;
  status: 'pending' | 'processing';
}

export type AdminExperienceChangeRequest<Id = string, Timestamp = string> =
  | (AdminExperienceChangeRequestBase<Id, Timestamp> & {
      kind: 'edit';
      proposed: AdminExperienceChangeProposal;
    })
  | (AdminExperienceChangeRequestBase<Id, Timestamp> & { kind: 'remove' });

export type AdminExperienceChangeDecision = 'approve' | 'reject';

export interface AdminExperienceChangeLink<Timestamp = string> {
  path: string;
  expiresAt: Timestamp;
}

export interface AdminExperienceChangeDecisionResult<Id = string> {
  _id: Id;
  status: 'approved' | 'rejected';
}
