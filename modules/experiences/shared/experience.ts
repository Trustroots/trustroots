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

/** Dates and identifiers become strings when Express serialises the response. */
export interface ExperienceUser<Id = string, Timestamp = string> {
  _id: Id;
  username: string;
  name?: string;
  displayName?: string;
  avatar?: string;
  created?: Timestamp;
  gender?: string;
}

/** Reciprocal feedback contains neither member identities nor visibility. */
export interface ExperienceResponse<Id = string, Timestamp = string> {
  _id: Id;
  created: Timestamp;
  interactions: ExperienceInteractions;
  recommend: ExperienceRecommendation;
  feedbackPublic?: string;
}

/** Private feedback is omitted when the viewer is not its author. */
export interface ExperiencePayload<
  Id = string,
  Timestamp = string,
  Member = ExperienceUser<Id, Timestamp>,
> {
  _id: Id;
  created: Timestamp;
  public: boolean;
  userFrom: Member;
  userTo: Member;
  interactions?: ExperienceInteractions;
  recommend?: ExperienceRecommendation;
  feedbackPublic?: string;
  response: ExperienceResponse<Id, Timestamp> | null;
}

export type Experience = ExperiencePayload;
/** Create and read-mine can return unpopulated member identifiers. */
export type ExperienceMine = ExperiencePayload<
  string,
  string,
  string | ExperienceUser
>;

export interface ExperienceCount {
  count: number;
  hasPending?: boolean;
}
