import {
  UMAMI_BEFORE_SEND,
  installUmamiBeforeSend,
  scrubUmamiUrl,
  umamiBeforeSend,
  type UmamiPayload,
} from '@/modules/core/client/services/umami-before-send';
import { REACT_ROUTE_POLICIES } from '@/modules/core/shared/react-route-ownership.mts';

const ORIGIN = window.location.origin;

// One example address per dynamic route, with the template Umami should get.
const DYNAMIC_ROUTES: Array<[path: string, template: string]> = [
  ['/circles/hitchhikers', '/circles/:circle'],
  ['/messages/member1', '/messages/:username'],
  ['/profile/member1', '/profile/:username'],
  ['/profile/member1/about', '/profile/:username/about'],
  ['/profile/member1/accommodation', '/profile/:username/accommodation'],
  ['/profile/member1/contacts', '/profile/:username/contacts'],
  ['/profile/member1/experiences', '/profile/:username/experiences'],
  ['/profile/member1/experiences/new', '/profile/:username/experiences/new'],
  ['/profile/member1/overview', '/profile/:username/overview'],
  ['/profile/member1/tribes', '/profile/:username/tribes'],
  ['/experiences/0123456789abcdef01234567/change', '/experiences/:id/change'],
  ['/contact-add/0123456789abcdef01234567', '/contact-add/:userId'],
  ['/contact-confirm/0123456789abcdef01234567', '/contact-confirm/:contactId'],
  ['/offer/meet/0123456789abcdef01234567', '/offer/meet/:offerId'],
  ['/confirm-email/a1b2c3d4e5f6', '/confirm-email/:token'],
  ['/password/reset/a1b2c3d4e5f6', '/password/reset/:token'],
  ['/remove/a1b2c3d4e5f6', '/remove/:token'],
  [
    '/admin/support/requests/0123456789abcdef01234567',
    '/admin/support/requests/:requestId',
  ],
  ['/admin/support/member/member1', '/admin/support/member/:username'],
  ['/admin/user/member1', '/admin/user/:username'],
  ['/admin/circles/hitchhikers', '/admin/circles/:circle'],
];

function payload(overrides: Partial<UmamiPayload> = {}): UmamiPayload {
  return {
    website: 'website-id',
    hostname: window.location.hostname,
    title: 'Profile - Trustroots',
    url: `${ORIGIN}/`,
    referrer: '',
    ...overrides,
  };
}

function setGlobalPrivacyControl(value: unknown): void {
  Object.defineProperty(window.navigator, 'globalPrivacyControl', {
    configurable: true,
    value,
  });
}

afterEach(() => {
  delete (window.navigator as { globalPrivacyControl?: unknown })
    .globalPrivacyControl;
  delete (window as unknown as Record<string, unknown>)[UMAMI_BEFORE_SEND];
});

describe('scrubUmamiUrl', () => {
  it('has an example for every dynamic route', () => {
    const dynamicPolicies = REACT_ROUTE_POLICIES.map(
      route => route.path,
    ).filter(path => path.includes(':'));

    expect(DYNAMIC_ROUTES.map(([, template]) => template).sort()).toEqual(
      dynamicPolicies.sort(),
    );
  });

  it.each(DYNAMIC_ROUTES)('sends %s as the template %s', (path, template) => {
    expect(scrubUmamiUrl(`${ORIGIN}${path}`)).toBe(`${ORIGIN}${template}`);
    expect(scrubUmamiUrl(path)).toBe(template);
  });

  it.each([
    '/',
    '/profile/edit',
    '/profile/edit/account',
    '/password/reset/invalid',
    '/password/reset/success',
    '/offer/meet/add',
    '/admin/support/members',
  ])('keeps the static page %s as it is', path => {
    expect(scrubUmamiUrl(`${ORIGIN}${path}`)).toBe(`${ORIGIN}${path}`);
  });

  it('drops query strings and hashes', () => {
    expect(
      scrubUmamiUrl(`${ORIGIN}/experiences/abc/change?secret=s3cret#top`),
    ).toBe(`${ORIGIN}/experiences/:id/change`);
    expect(scrubUmamiUrl('/support?report=member1')).toBe('/support');
    expect(scrubUmamiUrl('/search?offer=abc&location=Berlin')).toBe('/search');
    expect(scrubUmamiUrl('/signup?tribe=hitchhikers')).toBe('/signup');
  });

  it('ignores a trailing slash', () => {
    expect(scrubUmamiUrl('/profile/member1/')).toBe('/profile/:username');
  });

  it('sends unknown addresses as the not-found page', () => {
    expect(scrubUmamiUrl('/member1')).toBe('/not-found');
    expect(scrubUmamiUrl('/circles/Not%20A%20Slug')).toBe('/not-found');
    expect(scrubUmamiUrl('/circles/hitchhikers/extra')).toBe('/not-found');
  });

  it('keeps only the origin of other sites', () => {
    expect(
      scrubUmamiUrl('https://mail.example.com/inbox/42?token=abc#msg'),
    ).toBe('https://mail.example.com');
  });

  it('passes empty values through and drops unparseable ones', () => {
    expect(scrubUmamiUrl('')).toBe('');
    expect(scrubUmamiUrl(undefined)).toBeUndefined();
    expect(scrubUmamiUrl('http://[broken')).toBe('');
  });
});

describe('umamiBeforeSend', () => {
  it('templates the page address and the referrer', () => {
    expect(
      umamiBeforeSend(
        'event',
        payload({
          url: `${ORIGIN}/password/reset/a1b2c3d4e5f6?x=1`,
          referrer: '/messages/member1#latest',
          name: 'password_reset_failed',
        }),
      ),
    ).toEqual(
      payload({
        url: `${ORIGIN}/password/reset/:token`,
        referrer: '/messages/:username',
        name: 'password_reset_failed',
      }),
    );
  });

  it('leaves payloads without addresses alone', () => {
    const rest = payload();
    delete rest.url;
    delete rest.referrer;

    expect(umamiBeforeSend('identify', rest)).toEqual(rest);
  });

  it('sends nothing when Global Privacy Control is on', () => {
    setGlobalPrivacyControl(true);

    expect(
      umamiBeforeSend('event', payload({ url: `${ORIGIN}/profile/member1` })),
    ).toBeNull();
  });

  it('sends when Global Privacy Control is off or unsupported', () => {
    setGlobalPrivacyControl(false);
    expect(umamiBeforeSend('event', payload())).toEqual(payload());

    delete (window.navigator as { globalPrivacyControl?: unknown })
      .globalPrivacyControl;
    expect(umamiBeforeSend('event', payload())).toEqual(payload());
  });
});

describe('installUmamiBeforeSend', () => {
  it('exposes the hook under the name the script tag points to', () => {
    installUmamiBeforeSend();

    expect(
      (window as unknown as Record<string, unknown>)[UMAMI_BEFORE_SEND],
    ).toBe(umamiBeforeSend);
    expect(UMAMI_BEFORE_SEND).toBe('trUmamiBeforeSend');
  });
});
