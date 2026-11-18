import type { EmailParams } from '../components/layout.tsx';

/** Base parameters for the preview server. */
export const previewParams = {
  headerUrl: 'https://www.trustroots.org/?utm_source=transactional-email',
  footerUrl: 'https://www.trustroots.org/?utm_source=transactional-email',
  supportUrl: 'https://www.trustroots.org/support',
  urlSupportPlainText: 'https://www.trustroots.org/support',
  profileUrl: 'https://www.trustroots.org/profile/alex',
} satisfies EmailParams;
