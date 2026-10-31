import type { NextFunction } from 'express';
import type { UserServerDocument } from '../models/user.server.types.mts';

export interface AvatarRequest {
  query: { size?: string; source?: string };
  user?: UserServerDocument | null;
  profile?: UserServerDocument | null;
  file?: { path: string };
}

export interface AuthenticatedAvatarRequest extends AvatarRequest {
  user: UserServerDocument;
}

export interface AvatarUploadRequest extends AuthenticatedAvatarRequest {
  file: { path: string };
}

export interface AvatarResponse {
  status(code: number): AvatarResponse;
  send(body: { message: string | boolean }): unknown;
  redirect(url: string): unknown;
}

export type AvatarNext = NextFunction;

export interface UsersAvatarController {
  avatarUpload(req: AvatarUploadRequest, res: AvatarResponse): void;
  avatarUploadField(
    req: AvatarRequest,
    res: AvatarResponse,
    next: AvatarNext,
  ): unknown;
  getAvatar(req: AuthenticatedAvatarRequest, res: AvatarResponse): unknown;
  userForAvatarByUserId(
    req: AuthenticatedAvatarRequest,
    res: AvatarResponse,
    next: AvatarNext,
    userId: string,
  ): Promise<unknown>;
}
