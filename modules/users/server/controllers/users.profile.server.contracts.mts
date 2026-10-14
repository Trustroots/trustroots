import type { NextFunction } from 'express';
import type {
  MiniProfile,
  ProfileTribe,
  PublicProviderIdentities,
} from '../../shared/profile.js';
import type { UserServerDocument } from '../models/user.server.types.mts';
import type {
  ProfileResponseDto,
  ServerProfileMembership,
  ServerPublicProfileResponse,
} from '../services/profile-response.server.service.mts';

export interface ProfileRequest {
  body: Record<string, unknown>;
  params: Record<string, string | undefined>;
  query: Record<string, unknown>;
  skip: number;
  user?: UserServerDocument | null;
  profile?: UserServerDocument | ProfilePayload | null;
  login?: (
    user: UserServerDocument,
    callback: (error?: Error | null) => void,
  ) => void;
}

export type AuthenticatedProfileRequest = ProfileRequest & {
  user: UserServerDocument;
};

export type MiniProfileRequest = Omit<ProfileRequest, 'profile'> & {
  profile?: UserServerDocument | null;
};

export interface ProfileErrorResponse {
  message: string | true;
  detail?: string;
}

export type ProfilePayload =
  | ProfileResponseDto<import('mongoose').Types.ObjectId, Date>
  | ServerPublicProfileResponse<import('mongoose').Types.ObjectId, Date>;

export interface SanitizedProfileRecord {
  [field: string]: unknown;
  _id: import('mongoose').Types.ObjectId;
  username: string;
  displayName?: string;
  description?: string;
  roles?: string[];
  member?: Array<{
    tribe:
      | import('mongoose').Types.ObjectId
      | ProfileTribe<import('mongoose').Types.ObjectId>
      | null;
    since?: Date;
  }>;
  memberIds?: string[];
  additionalProvidersData?: PublicProviderIdentities;
  blocked?: import('mongoose').Types.ObjectId[];
  isGreeter?: boolean;
  isVolunteer?: boolean;
  isVolunteerAlumni?: boolean;
  usernameUpdateAllowed?: boolean;
  updated?: Date;
  passwordUpdated?: Date;
  usernameUpdated?: Date;
}

export interface ProfileMembershipResponse {
  message: string;
  tribe: Partial<
    import('../../shared/profile.js').ProfileTribe<
      import('mongoose').Types.ObjectId
    >
  >;
  user?: ProfilePayload;
}

export interface SanitizedProfileRequest extends Omit<
  ProfileRequest,
  'profile'
> {
  user: UserServerDocument;
  profile?: ProfilePayload | null;
}

export type ProfileResponseBody =
  | undefined
  | ProfileErrorResponse
  | Record<string, never>
  | ProfileResponseDto<import('mongoose').Types.ObjectId, Date>
  | ServerPublicProfileResponse<import('mongoose').Types.ObjectId, Date>
  | MiniProfile<import('mongoose').Types.ObjectId, Date>
  | ServerProfileMembership<import('mongoose').Types.ObjectId, Date>[]
  | ProfileMembershipResponse
  | Array<
      | ProfileResponseDto<import('mongoose').Types.ObjectId, Date>
      | ServerPublicProfileResponse<import('mongoose').Types.ObjectId, Date>
      | MiniProfile<import('mongoose').Types.ObjectId, Date>
    >;

export interface ProfileResponse {
  status(code: number): ProfileResponse;
  send(body: ProfileResponseBody): unknown;
  json(body: ProfileResponseBody): unknown;
  redirect(url: string): unknown;
}
export type ProfileNext = NextFunction;

export interface UserProfileController {
  userProfileFields: string;
  userMiniProfileFields: string;
  userListingProfileFields: string;
  userSearchProfileFields: string;
  update(req: ProfileRequest, res: ProfileResponse): unknown;
  initializeRemoveProfile(req: ProfileRequest, res: ProfileResponse): unknown;
  removeProfile(req: ProfileRequest, res: ProfileResponse): unknown;
  getUser(req: SanitizedProfileRequest, res: ProfileResponse): unknown;
  getMiniUser(req: MiniProfileRequest, res: ProfileResponse): unknown;
  userMiniByID(
    req: AuthenticatedProfileRequest,
    res: ProfileResponse,
    next: ProfileNext,
    userId: string,
  ): unknown;
  userByUsername(
    req: ProfileRequest,
    res: ProfileResponse,
    next: ProfileNext,
    username: string,
  ): unknown;
  sanitizeProfile(
    profile: UserServerDocument | null | undefined,
    authenticatedUser?: UserServerDocument | null,
  ): ProfilePayload | undefined;
  sanitizeOwnProfile(
    profile: UserServerDocument | null | undefined,
  ): ProfilePayload | undefined;
  joinTribe(req: ProfileRequest, res: ProfileResponse): unknown;
  leaveTribe(req: ProfileRequest, res: ProfileResponse): unknown;
  getUserMemberships(req: ProfileRequest, res: ProfileResponse): unknown;
  removePushRegistration(req: ProfileRequest, res: ProfileResponse): unknown;
  addPushRegistration(req: ProfileRequest, res: ProfileResponse): unknown;
  search(req: ProfileRequest, res: ProfileResponse, next: ProfileNext): unknown;
}
