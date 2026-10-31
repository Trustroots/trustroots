export interface SparkpostDay {
  date: string;
  signups: number;
  messages: number;
  sent: number | null;
  delivered: number | null;
  bounced: number | null;
  opens: number | null;
  complaints: number | null;
}
export interface SparkpostOverview {
  provider: 'ready' | 'disabled' | 'unavailable';
  rows: SparkpostDay[];
}
export interface SparkpostEvents {
  date: string;
  capped: boolean;
  nextCursor?: string;
  events: Array<{
    timestamp: string;
    type: string;
    campaign: string;
    recipientDomain: string;
    messageId?: string;
    subject?: string;
    recipient?: string;
    account?: { username: string; created: string; public: boolean };
  }>;
}
export interface SparkpostPreview {
  from: string;
  to: string;
  awaitingConfirmation: number;
  jobsInspected: number;
  capped: boolean;
  campaigns: Array<{ campaign: string; count: number }>;
}

export interface RecoveryCandidate {
  key: string;
  kind: 'signup' | 'message';
  recipient: string;
  username: string;
  description: string;
  status?: string;
  created?: string;
}
export interface RecoveryDay {
  candidates: RecoveryCandidate[];
  more: boolean;
  page: number;
}
export interface RecoveryResult {
  key: string;
  status: string;
}
