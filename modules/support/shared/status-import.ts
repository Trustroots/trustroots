import type { SupportStatus } from './statuses.ts';

export interface SupportStatusImportEvidence {
  senderHash: string;
  category: string;
  submittedAt: string | null;
  normalisedMessageHash: string;
}

export interface SupportStatusImportItem {
  zendeskTicketId: number;
  status: SupportStatus;
  updatedAt: string;
  fingerprint: string;
  evidence?: SupportStatusImportEvidence;
}

export interface SupportStatusImportManifest {
  version: 1 | 2;
  exportedAt: string;
  items: SupportStatusImportItem[];
}

export interface SupportStatusImportCounts {
  total: number;
  eligible: number;
  suggested: number;
  alreadyApplied: number;
  skipped: number;
  skippedByReason: Record<string, number>;
}

export interface SupportStatusImportChange {
  requestId: string;
  zendeskTicketId: number;
  currentStatus: SupportStatus | 'unconfirmed';
  importedStatus: SupportStatus;
  updatedAt: string;
  matchKind: 'exact';
  reason: 'exact request fingerprint';
}

export interface SupportStatusImportMatchCandidate {
  requestId: string;
  category: string;
  submittedAt: string | null;
  matchKind: 'suggested';
  reason: 'same sender, same category, submitted within 60 seconds, equivalent message after formatting normalisation';
  timeDifferenceSeconds: number;
  competingCandidateCount: number;
  currentStatus: SupportStatus | 'unconfirmed';
  importedStatus: SupportStatus;
}

export interface SupportStatusImportMatchReview {
  zendeskTicketId: number;
  category: string;
  submittedAt: string | null;
  importedStatus: SupportStatus;
  candidates: SupportStatusImportMatchCandidate[];
}

export interface SupportStatusImportSelection {
  zendeskTicketId: number;
  requestId: string;
}

export interface SupportStatusImportPreviewResponse {
  previewId: string;
  counts: SupportStatusImportCounts;
  changes: SupportStatusImportChange[];
  matchReviews: SupportStatusImportMatchReview[];
  expiresAt: string;
}

export interface SupportStatusImportApplyResponse {
  applied: number;
  alreadyApplied: number;
  skipped: number;
}
