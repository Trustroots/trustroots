import mongoose from 'mongoose';
import validator from 'validator';
import {
  KEYWORDS,
  matchSignupProfile,
} from './signup-safety.server.service.mts';
import type {
  SignupReviewRule,
  SignupReviewRules,
} from '../models/signup-review-rules.server.model.mts';
import log from '../../../../config/lib/logger.mjs';

export const RULES_ID = 'signup-review';

export function normaliseReviewRules(
  input: unknown,
): SignupReviewRule[] | null {
  if (!Array.isArray(input) || input.length > 500) return null;
  const rules: SignupReviewRule[] = [];
  const keys = new Set<string>();
  for (const item of input) {
    if (
      !item ||
      typeof item !== 'object' ||
      !['keyword', 'email', 'domain'].includes(item.kind) ||
      typeof item.value !== 'string'
    )
      return null;
    const value = item.value.trim().toLowerCase();
    if (
      !value ||
      value.length > 254 ||
      [...value].some(
        character =>
          character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      ) ||
      (item.kind === 'email' && !validator.isEmail(value)) ||
      (item.kind === 'domain' && !validator.isFQDN(value)) ||
      keys.has(`${item.kind}:${value}`)
    )
      return null;
    keys.add(`${item.kind}:${value}`);
    rules.push({ kind: item.kind, value });
  }
  return rules;
}

export async function getReviewRules(): Promise<SignupReviewRules> {
  const saved = await mongoose
    .model<SignupReviewRules>('SignupReviewRules')
    .findById(RULES_ID)
    .lean();
  return (
    saved || {
      _id: RULES_ID,
      revision: 0,
      rules: KEYWORDS.map(value => ({ kind: 'keyword', value })),
    }
  );
}

interface SignupProfile {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  username?: string;
  email?: string;
}
export function matchReviewRules(
  profile: SignupProfile,
  rules: SignupReviewRule[],
): string[] {
  const text = [
    profile.firstName,
    profile.lastName,
    profile.displayName,
    profile.username,
  ]
    .join(' ')
    .toLowerCase();
  const email = (profile.email || '').trim().toLowerCase();
  const domain = email.slice(email.lastIndexOf('@') + 1);
  return rules
    .filter(rule =>
      rule.kind === 'keyword'
        ? text.includes(rule.value)
        : rule.kind === 'email'
          ? email === rule.value
          : domain === rule.value,
    )
    .map(rule => `${rule.kind}: ${rule.value}`);
}

export async function matchSignupReviewRules(
  profile: SignupProfile,
): Promise<string[]> {
  try {
    return matchReviewRules(profile, (await getReviewRules()).rules);
  } catch (error) {
    log('error', 'Signup review rules could not be loaded.', { error });
    return matchSignupProfile(profile);
  }
}
