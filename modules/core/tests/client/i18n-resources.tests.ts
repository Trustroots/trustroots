import { createInstance } from 'i18next';
import { languageCookie, localeBackend } from '@/config/client/i18n-resources';

function loadTranslations(options = {}) {
  const instance = createInstance();
  return instance
    .use(languageCookie)
    .use(localeBackend)
    .init({ fallbackLng: 'en', retryTimeout: 1, ...options })
    .then(() => instance);
}

afterEach(() => {
  document.cookie = 'i18n=; Path=/; Max-Age=0';
  vi.unstubAllGlobals();
});

it('reads the saved language and fetches namespaces on demand with English fallback', async () => {
  document.cookie = 'i18n=fr; Path=/';
  const fetchTranslations = vi.fn(async (url: string) => {
    const translations: Record<string, Record<string, string>> = {
      '/locales/fr/translation.json': { greeting: 'Bonjour' },
      '/locales/en/translation.json': {
        greeting: 'Hello',
        farewell: 'Goodbye',
      },
      '/locales/en/users.json': { profile: 'Profile' },
    };
    const data = translations[url];
    return data ? Response.json(data) : new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchTranslations);

  const instance = await loadTranslations();
  expect(instance.language).toBe('fr');
  expect(instance.t('greeting')).toBe('Bonjour');
  expect(instance.t('farewell')).toBe('Goodbye');
  expect(fetchTranslations).not.toHaveBeenCalledWith('/locales/en/users.json');

  await instance.loadNamespaces('users');
  expect(instance.t('profile', { ns: 'users' })).toBe('Profile');
  expect(
    fetchTranslations.mock.calls.filter(
      ([url]) => url === '/locales/fr/users.json',
    ),
  ).toHaveLength(1);

  await instance.changeLanguage('en');
  expect(document.cookie).toContain('i18n=en');
  expect((await loadTranslations()).language).toBe('en');
});

it('falls back to English when the saved language is malformed', async () => {
  document.cookie = 'i18n=%E0%A4; Path=/';
  const fetchTranslations = vi.fn(async () =>
    Response.json({ greeting: 'Hello' }),
  );
  vi.stubGlobal('fetch', fetchTranslations);

  const instance = await loadTranslations();
  expect(instance.language).toBe('en');
  expect(fetchTranslations).toHaveBeenCalledExactlyOnceWith(
    '/locales/en/translation.json',
  );
});

it('retries a temporary server error', async () => {
  const fetchTranslations = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ greeting: 'Hello' }));
  vi.stubGlobal('fetch', fetchTranslations);

  const instance = await loadTranslations({ maxRetries: 1 });
  expect(instance.t('greeting')).toBe('Hello');
  expect(fetchTranslations).toHaveBeenCalledTimes(2);
});
