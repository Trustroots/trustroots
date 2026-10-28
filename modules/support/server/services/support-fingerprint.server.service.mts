import { createHash } from 'node:crypto';
import { Autolinker } from 'autolinker';
import { SUPPORT_CATEGORIES } from '../../shared/categories.ts';

export interface SupportFingerprintInput {
  category: keyof typeof SUPPORT_CATEGORIES;
  email: string;
  message: string;
}

export function normaliseStoredSupportCategory(
  category: unknown,
  reportMember?: unknown,
): keyof typeof SUPPORT_CATEGORIES | null {
  if (category === undefined || category === null || category === '') {
    return typeof reportMember === 'string' && reportMember.trim()
      ? 'reportMember'
      : 'other';
  }
  return typeof category === 'string' &&
    Object.hasOwn(SUPPORT_CATEGORIES, category)
    ? (category as keyof typeof SUPPORT_CATEGORIES)
    : null;
}

export function normaliseSupportFingerprintInput({
  category,
  email,
  message,
}: SupportFingerprintInput): [string, string, string] {
  return [
    category,
    email.trim().toLowerCase(),
    message.replace(/\r\n/g, '\n').trim(),
  ];
}

export function supportRequestFingerprint(
  input: SupportFingerprintInput,
): string {
  return createHash('sha256')
    .update(JSON.stringify(normaliseSupportFingerprintInput(input)), 'utf8')
    .digest('hex');
}

/** The pre-August-2017 mail template escaped these five HTML characters. */
function escapeHistoricalEmail(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Original first; alternatives reproduce mail rendering, not fuzzy matching. */
export function supportRequestImportFingerprints(
  input: SupportFingerprintInput,
): string[] {
  const expandedMessage = Autolinker.link(input.message, {
    urls: true,
    email: false,
    phone: false,
    mention: false,
    hashtag: false,
    stripPrefix: false,
    replaceFn: match => match.getAnchorHref(),
  });
  // These alternatives come from disjoint mail-template eras: the earlier
  // template escaped values, while the later renderer decoded text before
  // applying Autolinker. Do not combine the transformations into a cross-product.
  return [
    ...new Set([
      supportRequestFingerprint(input),
      supportRequestFingerprint({
        ...input,
        email: escapeHistoricalEmail(input.email),
        message: escapeHistoricalEmail(input.message),
      }),
      supportRequestFingerprint({ ...input, message: expandedMessage }),
    ]),
  ];
}
