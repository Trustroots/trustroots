import type { SupportStatus } from './statuses.ts';

export interface SupportStatusImportItem {
  zendeskTicketId: number;
  status: SupportStatus;
  updatedAt: string;
  fingerprint: string;
}

export interface SupportStatusImportManifest {
  version: 1;
  exportedAt: string;
  items: SupportStatusImportItem[];
}

export interface SupportStatusImportCounts {
  total: number;
  eligible: number;
  alreadyApplied: number;
  skipped: number;
  skippedByReason: Record<string, number>;
}

export interface SupportStatusImportChange {
  requestId: string;
  zendeskTicketId: number;
  currentStatus: SupportStatus;
  importedStatus: SupportStatus;
  updatedAt: string;
}

export interface SupportStatusImportPreviewResponse {
  previewId: string;
  counts: SupportStatusImportCounts;
  changes: SupportStatusImportChange[];
  expiresAt: string;
}

export interface SupportStatusImportApplyResponse {
  applied: number;
  alreadyApplied: number;
  skipped: number;
}
