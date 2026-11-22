import { text } from './text.ts';

interface Params {
  matchedKeywords?: string;
  memberName?: string;
  username?: string;
  adminProfileUrl?: string;
}

export default function flaggedSignupAlert(p: Params): string {
  return text`Internal-only signup safety review alert.

The new signup matched: ${p.matchedKeywords}
Member: ${p.memberName} (@${p.username})
Admin profile: ${p.adminProfileUrl}
`.value;
}
