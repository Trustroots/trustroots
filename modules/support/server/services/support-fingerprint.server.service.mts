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

function normaliseSupportFingerprintInput({
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

/** Formatting equivalence used only to propose a reviewable import candidate. */
export function normaliseSupportImportMessage(message: string): string {
  const decoded = message.replace(
    /&(#(?:x[\da-f]+|\d+)|amp|lt|gt|quot|#39|apos);/gi,
    entity => {
      const key = entity.toLowerCase();
      const named: Record<string, string> = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&apos;': "'",
      };
      if (named[key] !== undefined) return named[key]!;
      const numeric = key.startsWith('&#x')
        ? Number.parseInt(key.slice(3, -1), 16)
        : Number.parseInt(key.slice(2, -1), 10);
      if (!Number.isInteger(numeric) || numeric < 0 || numeric > 0x10ffff)
        return entity;
      return String.fromCodePoint(numeric);
    },
  );
  const lineNormalised = decoded
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/[\t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  // The legacy support mail renderer expands bare www URLs to http URLs.
  return Autolinker.link(lineNormalised, {
    urls: true,
    email: false,
    phone: false,
    mention: false,
    hashtag: false,
    stripPrefix: false,
    replaceFn: match => match.getAnchorHref(),
  });
}

export function supportImportSenderHash(email: string): string {
  return createHash('sha256')
    .update(email.trim().toLowerCase(), 'utf8')
    .digest('hex');
}

export function supportImportMessageHash(message: string): string {
  return createHash('sha256')
    .update(normaliseSupportImportMessage(message), 'utf8')
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
