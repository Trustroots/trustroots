const PREFIX = 'trustroots:experience-draft:v1:';
const LIFETIME = 7 * 24 * 60 * 60 * 1000;

export function draftKey(author, recipient) {
  return `${PREFIX}${author}:${recipient}`;
}

export function readDraft(key) {
  try {
    const value = localStorage.getItem(key);
    if (!value) return { draft: null, available: true };
    const draft = JSON.parse(value);
    if (
      !draft ||
      !Number.isFinite(draft.updatedAt) ||
      draft.updatedAt > Date.now() ||
      Date.now() - draft.updatedAt >= LIFETIME ||
      typeof draft.feedbackPublic !== 'string' ||
      !['yes', 'no', 'unknown', null].includes(draft.recommend) ||
      !['met', 'host', 'guest'].every(name => typeof draft[name] === 'boolean')
    ) {
      localStorage.removeItem(key);
      return { draft: null, available: true };
    }
    return { draft, available: true };
  } catch {
    return { draft: null, available: false };
  }
}

export function saveDraft(key, draft) {
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

export function removeDraft(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
