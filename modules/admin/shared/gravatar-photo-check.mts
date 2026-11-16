export interface GravatarPhotoCheck {
  state: 'running' | 'complete' | 'failed';
  startedAt: string;
  finishedAt?: string;
  retired?: number;
  counts: {
    available: number;
    unavailable: number;
    inconclusive: number;
  };
}
