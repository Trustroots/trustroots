import type { Types } from 'mongoose';
import type { Metadata } from 'sharp';

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
  enqueueAvatarProcessing(job: AvatarProcessingJob): boolean;
  maxHeight: number;
  maxPixels: number;
  maxQueuedUploads: number;
  maxThumbnailBytes: number;
  maxWidth: number;
  processAvatar(
    job: Pick<AvatarProcessingJob, 'sourcePath' | 'userId'>,
  ): Promise<AvatarProcessingResult>;
  removeAvatarVersion(avatarDirectory: string, version: string): Promise<void>;
  validateDimensions(
    metadata: Pick<Metadata, 'format' | 'height' | 'pages' | 'width'>,
  ): void;
  validateVersion(version: string): void;
}
