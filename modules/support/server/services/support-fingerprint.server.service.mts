import { createHash } from 'node:crypto';
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
