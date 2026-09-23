import {
  getMobileProfileRedirect,
  getProfileViewTab,
  getProfileViewTabStateName,
  isMobileProfileViewport,
} from '@/modules/users/client/utils/profile-routes';

describe('profile view routes', () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it('identifies the root and each read-only tab', () => {
    expect(getProfileViewTab('/profile/alice', 'alice')).toBe('about');
    expect(getProfileViewTab('/profile/alice/', 'alice')).toBe('about');
    for (const tab of [
      'about',
      'overview',
      'accommodation',
      'contacts',
      'tribes',
      'experiences',
    ]) {
      expect(getProfileViewTab(`/profile/alice/${tab}`, 'alice')).toBe(tab);
    }
    expect(getProfileViewTab('/profile/alice/unknown', 'alice')).toBe('about');
    expect(getProfileViewTab('/profile/bob/contacts', 'alice')).toBe('about');
  });

  it('maps tabs to the existing Angular state names', () => {
    expect(getProfileViewTabStateName('/profile/alice/contacts', 'alice')).toBe(
      'profile.contacts',
    );
    expect(
      getProfileViewTabStateName('/profile/alice/experiences', 'alice'),
    ).toBe('profile.experiences.list');
    expect(getProfileViewTabStateName('/profile/alice', 'alice')).toBe(
      'profile.about',
    );
  });

  it('opens the mobile overview by default but keeps explicit tabs', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390,
    });
    expect(isMobileProfileViewport()).toBe(true);
    expect(getMobileProfileRedirect('/profile/alice', 'alice')).toBe(
      '/profile/alice/overview',
    );
    expect(getMobileProfileRedirect('/profile/alice/', 'alice')).toBe(
      '/profile/alice/overview',
    );
    expect(getMobileProfileRedirect('/profile/alice/about', 'alice')).toBe(
      null,
    );
    expect(getMobileProfileRedirect('/profile/alice/contacts', 'alice')).toBe(
      null,
    );
  });

  it('keeps desktop readers on the main profile layout', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1024,
    });
    expect(isMobileProfileViewport()).toBe(false);
    expect(getMobileProfileRedirect('/profile/alice/overview', 'alice')).toBe(
      '/profile/alice',
    );
    expect(
      getMobileProfileRedirect('/profile/alice/accommodation', 'alice'),
    ).toBe('/profile/alice');
    expect(getMobileProfileRedirect('/profile/alice/contacts', 'alice')).toBe(
      null,
    );
  });
});
