import type {
  ExperienceDraft,
  StoredExperienceDraft,
} from '../../shared/experience';

const PREFIX = 'trustroots:experience-draft:v1:';
const LIFETIME = 7 * 24 * 60 * 60 * 1000;

export interface DraftReadResult {
  draft: StoredExperienceDraft | null;
  available: boolean;
}

export function draftKey(author: string, recipient: string): string {
  return `${PREFIX}${author}:${recipient}`;
}

export function readDraft(key: string): DraftReadResult {
  try {
    const value = localStorage.getItem(key);
    if (!value) return { draft: null, available: true };
    const draft: unknown = JSON.parse(value);
    if (
      !isStoredExperienceDraft(draft) ||
      draft.updatedAt > Date.now() ||
      Date.now() - draft.updatedAt >= LIFETIME
    ) {
      localStorage.removeItem(key);
      return { draft: null, available: true };
    }
    return { draft, available: true };
  } catch {
    return { draft: null, available: false };
  }
}

export function saveDraft(key: string, draft: ExperienceDraft): boolean {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ ...draft, updatedAt: Date.now() }),
    );
    return true;
  } catch {
    return false;
  }
}

export function removeDraft(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function isStoredExperienceDraft(
  value: unknown,
): value is StoredExperienceDraft {
  if (typeof value !== 'object' || value === null) return false;
  const draft = value as Partial<StoredExperienceDraft>;

  return (
    typeof draft.updatedAt === 'number' &&
    Number.isFinite(draft.updatedAt) &&
    typeof draft.feedbackPublic === 'string' &&
    (draft.recommend === 'yes' ||
      draft.recommend === 'no' ||
      draft.recommend === 'unknown' ||
      draft.recommend === null) &&
    typeof draft.met === 'boolean' &&
    typeof draft.host === 'boolean' &&
    typeof draft.guest === 'boolean'
  );
}
