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
  events: Array<{
    timestamp: string;
    type: string;
    campaign: string;
    recipientDomain: string;
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
