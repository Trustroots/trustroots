import { text } from './text.ts';

interface Params {
  shareUrl: string;
  urlSupportPlainText: string;
}

export default function experienceReplyReminder({
  shareUrl,
  urlSupportPlainText,
}: Params): string {
  return text`----------------------------------------------------------------------


A Trustroots member shared an Experience with you. You can share your own account before their Experience becomes public.

${shareUrl}

If you’d rather not share an Experience, there’s nothing you need to do.


--${' '}
Trustroots



This is an automated email. Please don’t reply directly.
Need help? Contact the Trustroots team: ${urlSupportPlainText}
`.value;
}
