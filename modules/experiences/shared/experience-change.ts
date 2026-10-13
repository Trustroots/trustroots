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
export interface ExperienceChangeAccess {
  _id: string;
  public: boolean;
  canEdit: boolean;
  feedbackPublic?: string;
  recommend?: ExperienceRecommendation;
  interactions?: ExperienceInteractions;
}

export type ExperienceChangeRequestKind = 'edit' | 'remove';
export type ExperienceChangeRequestStatus = 'pending' | 'approved' | 'rejected';

/** Processing requests are exposed as pending by the request-status endpoint. */
export interface ExperienceChangeRequestSummary {
  _id: string;
  kind: ExperienceChangeRequestKind;
  status: ExperienceChangeRequestStatus;
  createdAt: string;
  reviewedAt?: string;
}
