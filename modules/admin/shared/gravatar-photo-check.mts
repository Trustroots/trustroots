export interface GravatarPhotoCheck {
  state: 'running' | 'complete' | 'failed';
  startedAt: string;
  finishedAt?: string;
  counts: {
    available: number;
    unavailable: number;
    inconclusive: number;
  };
}
