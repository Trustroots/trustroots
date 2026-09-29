import {
  draftKey,
  readDraft,
  saveDraft,
  removeDraft,
} from '../../../client/utils/draft';

const key = draftKey('sample-author', 'sample-recipient');
const draft = {
  met: true,
  host: false,
  guest: false,
  recommend: 'yes',
  feedbackPublic: 'A fictional experience.',
};

afterEach(() => {
  jest.restoreAllMocks();
  localStorage.clear();
});

it('scopes drafts to both members and writes a timestamp', () => {
  expect(saveDraft(key, draft)).toBe(true);
  expect(readDraft(key)).toEqual({
    available: true,
    draft: { ...draft, updatedAt: expect.any(Number) },
  });
  expect(
    readDraft(draftKey('other-author', 'sample-recipient')).draft,
  ).toBeNull();
  expect(
    readDraft(draftKey('sample-author', 'other-recipient')).draft,
  ).toBeNull();
  expect(removeDraft(key)).toBe(true);
  expect(readDraft(key)).toEqual({ available: true, draft: null });
});

it.each([
  null,
  { ...draft },
  { ...draft, updatedAt: Date.now() + 86400000 },
  { ...draft, updatedAt: Date.now() - 7 * 86400000 },
  { ...draft, updatedAt: Date.now(), feedbackPublic: 3 },
  { ...draft, updatedAt: Date.now(), recommend: 'invalid' },
  { ...draft, updatedAt: Date.now(), met: 'true' },
])('discards malformed or expired drafts (%j)', value => {
  localStorage.setItem(key, JSON.stringify(value));
  expect(readDraft(key)).toEqual({ available: true, draft: null });
  expect(localStorage.getItem(key)).toBeNull();
});

it('handles invalid JSON without preventing editing', () => {
  localStorage.setItem(key, '{invalid');
  expect(readDraft(key)).toEqual({ available: false, draft: null });
});

it('handles storage being denied or full', () => {
  for (const method of ['getItem', 'setItem', 'removeItem']) {
    jest.spyOn(Storage.prototype, method).mockImplementation(() => {
      throw new Error('Storage denied');
    });
  }
  expect(readDraft(key)).toEqual({ available: false, draft: null });
  expect(saveDraft(key, draft)).toBe(false);
  expect(removeDraft(key)).toBe(false);
});
