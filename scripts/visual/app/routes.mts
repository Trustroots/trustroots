// The full-app targets: every route policy of the head checkout, filled in
// with seeded parameters, plus open states that a plain page load misses.
import type { Page } from '@playwright/test';

export type VisualUser = 'visitor' | 'member' | 'admin' | 'pending';

export interface Target {
  /** Stable name, used in result keys. */
  name: string;
  path: string;
  user: VisualUser;
  /** Runs after load and before the capture. */
  prepare?: (page: Page) => Promise<void>;
  /** Paths whose API responses are held, to show loading states. */
  holdApi?: RegExp;
  /** Paths whose API responses become HTTP 500. */
  failApi?: RegExp;
  /** Element to capture instead of the full page. */
  clip?: string;
}

/** Seeded member names, from scripts/e2e/data.mts. */
export const MEMBER = 'e2e-seeded-portland';
export const OTHER_MEMBER = 'e2e-seeded-berlin';
export const ADMIN = 'e2e-seeded-admin';
/** Has an experience waiting for their reply, so their profile shows a dot. */
export const PENDING_MEMBER = 'e2e-seeded-bob';

/** Who each signed-in visual user is. */
export const USERNAMES: Record<Exclude<VisualUser, 'visitor'>, string> = {
  member: MEMBER,
  admin: ADMIN,
  pending: PENDING_MEMBER,
};

export interface SeedParams {
  circle: string;
  otherMemberId: string;
  experienceId: string;
  contactId: string;
  offerId: string;
  requestId: string;
}

interface RoutePolicy {
  path: string;
  requiresAuth?: boolean;
  requiresRole?: string | readonly string[];
  redirectTo?: string;
}

function fill(path: string, params: SeedParams) {
  return path
    .replace(':circle', params.circle)
    .replace(':username', path.startsWith('/messages') ? OTHER_MEMBER : MEMBER)
    .replace(':userId', params.otherMemberId)
    .replace(':id', params.experienceId)
    .replace(':contactId', params.contactId)
    .replace(':offerId', params.offerId)
    .replace(':requestId', params.requestId)
    .replace(':token', 'visual-check-token');
}

export function nameOf(user: VisualUser, path: string) {
  const slug = path.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
  return `${user}__${slug || 'home'}`;
}

export function routeTargets(
  policies: RoutePolicy[],
  params: SeedParams,
): Target[] {
  const targets: Target[] = [];
  for (const policy of policies) {
    if (policy.redirectTo) continue;
    const path = fill(policy.path, params);
    const user: VisualUser = policy.requiresRole
      ? 'admin'
      : policy.requiresAuth
        ? 'member'
        : 'visitor';
    targets.push({ name: nameOf(user, path), path, user });
    // Pages that look different once signed in (header, calls to action).
    if (user === 'visitor' && /^\/(circles|$)/.test(policy.path)) {
      targets.push({ name: nameOf('member', path), path, user: 'member' });
    }
  }
  // Another member's profile shows the contact and message buttons.
  targets.push({
    name: nameOf('member', `/profile/${OTHER_MEMBER}`),
    path: `/profile/${OTHER_MEMBER}`,
    user: 'member',
  });
  return targets;
}

/** Open states: menus, errors, loading and interaction states. */
export function stateTargets(params: SeedParams): Target[] {
  void params;
  const focus = (selector: string) => async (page: Page) => {
    await page.keyboard.press('Shift');
    await page.locator(selector).first().focus();
  };
  const hover = (selector: string) => async (page: Page) => {
    await page.locator(selector).first().hover();
  };
  return [
    {
      name: 'state__signin_button_hover',
      path: '/signin',
      user: 'visitor',
      prepare: hover('form button[type="submit"]'),
    },
    {
      name: 'state__signin_button_focus_visible',
      path: '/signin',
      user: 'visitor',
      prepare: focus('form button[type="submit"]'),
    },
    {
      name: 'state__signin_error_alert',
      path: '/signin',
      user: 'visitor',
      failApi: /\/api\/auth\/signin/,
      prepare: async page => {
        await page
          .locator('input[name="username"], #username')
          .first()
          .fill('nobody');
        await page
          .locator('input[type="password"]')
          .first()
          .fill('wrong-password');
        await page.locator('form button[type="submit"]').first().click();
        await page.waitForTimeout(500);
      },
    },
    {
      name: 'state__messages_loading',
      path: '/messages',
      user: 'member',
      holdApi: /\/api\/messages(\?|$)/,
    },
    {
      name: 'state__thread_loading',
      path: `/messages/${OTHER_MEMBER}`,
      user: 'member',
      holdApi: /\/api\/messages\/[^/]+$/,
    },
    {
      name: 'state__thread_reply_hover',
      path: `/messages/${OTHER_MEMBER}`,
      user: 'member',
      prepare: hover('.message-reply-btn, form button[type="submit"]'),
    },
    {
      name: 'state__profile_edit_languages_error',
      path: '/profile/edit',
      user: 'member',
      failApi: /\/api\/languages/,
    },
    {
      name: 'state__search_filters_languages_error',
      path: '/search',
      user: 'member',
      failApi: /\/api\/languages/,
    },
    {
      // The experiences tab badge with its pending notification dot.
      name: 'state__profile_pending_experience_dot',
      path: `/profile/${PENDING_MEMBER}`,
      user: 'pending',
    },
    {
      name: 'state__header_tab_focus',
      path: '/',
      user: 'member',
      prepare: async page => {
        for (let i = 0; i < 3; i++) await page.keyboard.press('Tab');
      },
    },
  ];
}
