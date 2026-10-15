import type { Types } from 'mongoose';
import type { Command } from 'gm';

export interface AvatarProcessingResult {
  version: string;
  versionDirectory: string;
  avatarDirectory: string;
}

export interface AvatarProcessingJob {
  sourcePath: string;
  userId: Types.ObjectId;
  callback: (error: Error | null, result?: AvatarProcessingResult) => void;
}

export interface AvatarProcessingService {
  avatarSizes: number[];
  createLimitedCommand(
    sourcePath: string | null,
    cancellationEmitter?: NodeJS.EventEmitter,
  ): Command;
  enqueueAvatarProcessing(job: AvatarProcessingJob): boolean;
  getNativeResourceLimits(): Array<[string, string]>;
  maxHeight: number;
  maxPixels: number;
  maxQueuedUploads: number;
  maxThumbnailBytes: number;
  maxWidth: number;
  processAvatar(
    job: Pick<AvatarProcessingJob, 'sourcePath' | 'userId'>,
  ): Promise<AvatarProcessingResult>;
  removeAvatarVersion(avatarDirectory: string, version: string): Promise<void>;
  validateDimensions(output: string): void;
  validateResourceList(output: string | Buffer): void;
  validateNativeResourceLimits(
    cancellationEmitter?: NodeJS.EventEmitter,
  ): Promise<void>;
  validateVersion(version: string): void;
}
