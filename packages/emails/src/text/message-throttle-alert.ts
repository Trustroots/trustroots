import { text } from './text.ts';

interface Params {
  username?: string;
  adminProfileUrl?: string;
  timestamp?: string;
  recipientCount?: number;
  limit?: number;
  windowMinutes?: number;
}

export default function messageThrottleAlert(p: Params): string {
  return text`A member reached the messaging recipient limit.

Member: @${p.username}
Admin profile: ${p.adminProfileUrl}
Time (UTC): ${p.timestamp}
Distinct recipients in the current window: ${p.recipientCount}
Configured recipient limit: ${p.limit}
Configured window (minutes): ${p.windowMinutes}

Sending remains subject to the existing rolling window. Please review the member's profile if needed.
`.value;
}
