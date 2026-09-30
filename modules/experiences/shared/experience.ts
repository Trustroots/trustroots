export type ExperienceRecommendation = 'yes' | 'no' | 'unknown';

export interface ExperienceInteractions {
  met: boolean;
  guest: boolean;
  host: boolean;
}

/** Request payload accepted by POST /api/experiences. */
export interface CreateExperienceRequest {
  userTo?: string;
  interactions?: Partial<ExperienceInteractions>;
  recommend?: ExperienceRecommendation | null;
  feedbackPublic?: string;
}

/** Locally stored, unsent experience form values. */
export interface ExperienceDraft {
  met: boolean;
  host: boolean;
  guest: boolean;
  recommend: ExperienceRecommendation | null;
  feedbackPublic: string;
}

export interface StoredExperienceDraft extends ExperienceDraft {
  updatedAt: number;
}
