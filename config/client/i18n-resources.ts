import type { BackendModule, LanguageDetectorModule } from 'i18next';

const cookieName = 'i18n=';
const localeSegment = /^[a-z0-9_-]+$/i;

export const languageCookie: LanguageDetectorModule = {
  type: 'languageDetector',
  detect() {
    if (typeof document === 'undefined') return [];
    const cookie = document.cookie
      .split(';')
      .map(entry => entry.trim())
      .find(entry => entry.startsWith(cookieName));
    if (!cookie) return [];

    try {
      const language = decodeURIComponent(cookie.slice(cookieName.length));
      return localeSegment.test(language) ? [language] : [];
    } catch {
      return [];
    }
  },
  cacheUserLanguage(language) {
    if (typeof document !== 'undefined' && language !== 'cimode') {
      document.cookie = `${cookieName}${encodeURIComponent(language)}; Path=/; SameSite=Strict`;
    }
  },
};

export const localeBackend: BackendModule = {
  type: 'backend',
  callbackApi: true,
  init() {},
  read(language, namespace, callback) {
    if (!localeSegment.test(language) || !localeSegment.test(namespace)) {
      callback(new Error('Invalid translation language or namespace'), false);
      return;
    }

    fetch(`/locales/${language}/${namespace}.json`).then(
      response => {
        if (!response.ok) {
          callback(
            new Error(`Translation request returned HTTP ${response.status}`),
            response.status >= 500,
          );
          return;
        }

        response.json().then(
          translations => callback(null, translations),
          error => callback(error, false),
        );
      },
      error => callback(error, true),
    );
  },
};
