import type {
  ExperienceInteractions,
  ExperienceRecommendation,
} from './experience';

/** Values the author may propose for an existing Experience. */
export interface ExperienceChangeProposal {
  feedbackPublic: string;
  recommend: ExperienceRecommendation;
  interactions: ExperienceInteractions;
}

export type ExperienceChangeSubmission =
  { kind: 'edit'; proposed: ExperienceChangeProposal } | { kind: 'remove' };

/** The support-link endpoint omits private feedback for a recipient. */
export interface ExperienceChangeAccess<Id = string> {
  _id: Id;
  public: boolean;
  canEdit: boolean;
  feedbackPublic?: string;
  recommend?: ExperienceRecommendation;
  interactions?: ExperienceInteractions;
}

export type ExperienceChangeRequestKind = 'edit' | 'remove';
export type ExperienceChangeRequestStatus = 'pending' | 'approved' | 'rejected';
export type ExperienceChangeStoredRequestStatus =
  ExperienceChangeRequestStatus | 'processing';

/** The create endpoint returns the stored request fields without read-mine normalisation. */
export interface ExperienceChangeSubmissionResult<
  Id = string,
  Timestamp = string,
> {
  _id: Id;
  kind: ExperienceChangeRequestKind;
  status: ExperienceChangeStoredRequestStatus;
  createdAt: Timestamp;
}

/** Processing requests are exposed as pending by the request-status endpoint. */
export interface ExperienceChangeRequestSummary<
  Id = string,
  Timestamp = string,
> {
  _id: Id;
  kind: ExperienceChangeRequestKind;
  status: ExperienceChangeRequestStatus;
  createdAt: Timestamp;
  reviewedAt?: Timestamp;
}
