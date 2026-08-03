import {
  getMobileProfileRedirect,
  getProfileEditTab,
  getProfileEditTabPath,
  getProfileViewTab,
  getProfileViewTabStateName,
  isMobileProfileViewport,
} from '@/modules/users/client/utils/profile-routes';

describe('profile-routes', () => {
  describe('getProfileViewTab', () => {
    it('returns about for the profile root path', () => {
      expect(getProfileViewTab('/profile/alice', 'alice')).toBe('about');
      expect(getProfileViewTab('/profile/alice/', 'alice')).toBe('about');
    });

    it('returns the matching profile sub-tab', () => {
      expect(getProfileViewTab('/profile/alice/overview', 'alice')).toBe(
        'overview',
      );
      expect(getProfileViewTab('/profile/alice/accommodation', 'alice')).toBe(
        'accommodation',
      );
      expect(getProfileViewTab('/profile/alice/contacts', 'alice')).toBe(
        'contacts',
      );
      expect(getProfileViewTab('/profile/alice/tribes', 'alice')).toBe(
        'tribes',
      );
      expect(getProfileViewTab('/profile/alice/experiences', 'alice')).toBe(
        'experiences',
      );
      expect(getProfileViewTab('/profile/alice/experiences/new', 'alice')).toBe(
        'experiences-new',
      );
    });

    it('defaults to about for unknown suffixes', () => {
      expect(getProfileViewTab('/profile/alice/unknown', 'alice')).toBe(
        'about',
      );
    });
  });

  describe('getProfileViewTabStateName', () => {
    it('maps profile tabs to Angular-compatible state names', () => {
      expect(
        getProfileViewTabStateName('/profile/alice/contacts', 'alice'),
      ).toBe('profile.contacts');
      expect(
        getProfileViewTabStateName('/profile/alice/experiences/new', 'alice'),
      ).toBe('profile.experiences.new');
    });

    it('falls back to the about state for an unknown profile suffix', () => {
      expect(
        getProfileViewTabStateName('/profile/alice/unknown', 'alice'),
      ).toBe('profile.about');
    });
  });

  describe('getProfileEditTab', () => {
    it('returns the matching profile edit tab', () => {
      expect(getProfileEditTab('/profile/edit')).toBe('about');
      expect(getProfileEditTab('/profile/edit/')).toBe('about');
      expect(getProfileEditTab('/profile/edit/locations')).toBe('locations');
      expect(getProfileEditTab('/profile/edit/photo')).toBe('photo');
      expect(getProfileEditTab('/profile/edit/networks')).toBe('networks');
      expect(getProfileEditTab('/profile/edit/account')).toBe('account');
    });

    it('defaults to about for unknown edit paths', () => {
      expect(getProfileEditTab('/profile/edit/unknown')).toBe('about');
    });
  });

  describe('getProfileEditTabPath', () => {
    it('returns the path for each edit tab', () => {
      expect(getProfileEditTabPath('about')).toBe('/profile/edit');
      expect(getProfileEditTabPath('locations')).toBe(
        '/profile/edit/locations',
      );
      expect(getProfileEditTabPath('photo')).toBe('/profile/edit/photo');
      expect(getProfileEditTabPath('networks')).toBe('/profile/edit/networks');
      expect(getProfileEditTabPath('account')).toBe('/profile/edit/account');
    });

    it('falls back to the about path for unknown tabs', () => {
      expect(getProfileEditTabPath('unknown')).toBe('/profile/edit');
    });
  });

  describe('getMobileProfileRedirect', () => {
    const originalInnerWidth = window.innerWidth;

    afterEach(() => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: originalInnerWidth,
      });
    });

    it('redirects mobile about views to overview', () => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: 480,
      });

      expect(getMobileProfileRedirect('/profile/alice', 'alice')).toBe(
        '/profile/alice/overview',
      );
    });

    it('redirects desktop overview and accommodation views to about', () => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: 1024,
      });

      expect(getMobileProfileRedirect('/profile/alice/overview', 'alice')).toBe(
        '/profile/alice',
      );
      expect(
        getMobileProfileRedirect('/profile/alice/accommodation', 'alice'),
      ).toBe('/profile/alice');
    });

    it('returns null when no redirect is needed', () => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: 1024,
      });

      expect(getMobileProfileRedirect('/profile/alice/contacts', 'alice')).toBe(
        null,
      );
    });

    it('does not redirect mobile sub-tabs to the overview', () => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: 480,
      });

      expect(getMobileProfileRedirect('/profile/alice/contacts', 'alice')).toBe(
        null,
      );
    });
  });

  describe('isMobileProfileViewport', () => {
    const originalInnerWidth = window.innerWidth;

    afterEach(() => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: originalInnerWidth,
      });
    });

    it('treats narrow viewports as mobile profile viewports', () => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: 480,
      });

      expect(isMobileProfileViewport()).toBe(true);
    });

    it('treats wider viewports as desktop profile viewports', () => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: 481,
      });

      expect(isMobileProfileViewport()).toBe(false);
    });
  });
});
