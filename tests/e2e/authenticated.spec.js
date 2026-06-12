/* global document, window */

const fs = require('fs');
const path = require('path');
const { test, expect } = require('./test');

const {
  SEEDED_MEMBERS,
  createUser,
  registerViaApi,
  signInViaApi,
  signOut,
  waitForTribesList,
} = require('./helpers');

const userPath = path.join(__dirname, '.auth/user.json');
const seededMemberStoragePath = path.join(
  __dirname,
  '.auth/seeded-member.json',
);

const communityNotePlusCode = '9F4MG82G+7Q';
const communityNoteText = 'E2E community note: quiet courtyard with good tea.';

/** @type {ReturnType<typeof import('./helpers').createUser>} */
let user;

async function installNostrRelayStub(page) {
  await page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;

    function createEvent(type, target, extra = {}) {
      return {
        type,
        target,
        currentTarget: target,
        ...extra,
      };
    }

    function MockRelayWebSocket(url) {
      this.url = String(url);
      this.readyState = MockRelayWebSocket.CONNECTING;
      this.protocol = '';
      this.extensions = '';
      this.binaryType = 'blob';
      this.onopen = null;
      this.onmessage = null;
      this.onerror = null;
      this.onclose = null;
      this.listeners = {
        open: new Set(),
        message: new Set(),
        error: new Set(),
        close: new Set(),
      };

      window.setTimeout(() => {
        if (this.readyState !== MockRelayWebSocket.CONNECTING) return;
        this.readyState = MockRelayWebSocket.OPEN;
        this.dispatchEvent(createEvent('open', this));
      }, 0);
    }

    MockRelayWebSocket.CONNECTING = 0;
    MockRelayWebSocket.OPEN = 1;
    MockRelayWebSocket.CLOSING = 2;
    MockRelayWebSocket.CLOSED = 3;

    MockRelayWebSocket.prototype.addEventListener = function addEventListener(
      type,
      listener,
    ) {
      if (this.listeners[type]) {
        this.listeners[type].add(listener);
      }
    };

    MockRelayWebSocket.prototype.removeEventListener =
      function removeEventListener(type, listener) {
        if (this.listeners[type]) {
          this.listeners[type].delete(listener);
        }
      };

    MockRelayWebSocket.prototype.dispatchEvent = function dispatchEvent(event) {
      const handler = this[`on${event.type}`];
      if (typeof handler === 'function') {
        handler.call(this, event);
      }
      if (this.listeners[event.type]) {
        this.listeners[event.type].forEach(listener => {
          listener.call(this, event);
        });
      }
      return true;
    };

    MockRelayWebSocket.prototype.send = function send(data) {
      if (this.readyState !== MockRelayWebSocket.OPEN) return;

      let message;
      try {
        message = JSON.parse(data);
      } catch (e) {
        return;
      }

      if (Array.isArray(message) && message[0] === 'REQ') {
        const subscriptionId = message[1];
        window.setTimeout(() => {
          if (this.readyState !== MockRelayWebSocket.OPEN) return;
          this.dispatchEvent(
            createEvent('message', this, {
              data: JSON.stringify(['EOSE', subscriptionId]),
            }),
          );
        }, 0);
      }
    };

    MockRelayWebSocket.prototype.close = function close(code, reason) {
      if (this.readyState === MockRelayWebSocket.CLOSED) return;
      this.readyState = MockRelayWebSocket.CLOSED;
      this.dispatchEvent(
        createEvent('close', this, {
          code: code || 1000,
          reason: reason || '',
          wasClean: true,
        }),
      );
    };

    window.WebSocket = function WebSocket(url, protocols) {
      if (String(url).startsWith('wss://relay.trustroots.org')) {
        return new MockRelayWebSocket(url);
      }
      return new NativeWebSocket(url, protocols);
    };

    window.WebSocket.CONNECTING = MockRelayWebSocket.CONNECTING;
    window.WebSocket.OPEN = MockRelayWebSocket.OPEN;
    window.WebSocket.CLOSING = MockRelayWebSocket.CLOSING;
    window.WebSocket.CLOSED = MockRelayWebSocket.CLOSED;
  });
}

async function withSeededMemberPage(browser, baseURL, callback) {
  const context = await browser.newContext({
    baseURL,
    storageState: seededMemberStoragePath,
  });
  const page = await context.newPage();

  try {
    await callback(page);
  } finally {
    await context.close();
  }
}

async function showCommunityNotesSidebar(page) {
  await page.evaluate(
    ({ plusCode, noteText }) => {
      const searchRoot = document.querySelector('.search');
      if (!searchRoot || !window.angular) {
        throw new Error('Search Angular scope unavailable');
      }

      const scope = window.angular.element(searchRoot).scope();
      if (!scope || !scope.search) {
        throw new Error('Search controller scope unavailable');
      }

      const now = Math.floor(Date.now() / 1000);
      scope.$apply(() => {
        scope.search.offer = false;
        scope.search.loadingOffer = false;
        scope.search.communityNote = {
          plusCode,
          notes: [
            {
              id: 'e2e-community-note-1',
              content: noteText,
              created_at: now - 3600,
              pubkey:
                '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            },
            {
              id: 'e2e-community-note-2',
              content: 'E2E community note: late trains but friendly locals.',
              created_at: now - 7200,
              pubkey:
                'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
            },
          ],
        };
        scope.search.openSidebar('results');
      });
    },
    { plusCode: communityNotePlusCode, noteText: communityNoteText },
  );
}

test.describe('authenticated member flows', () => {
  test.beforeAll(async () => {
    user = JSON.parse(fs.readFileSync(userPath, 'utf8'));
  });

  test('search page loads for a signed in member', async ({ page }) => {
    await page.goto('/search');

    await expect(page).toHaveURL(/\/search/);
    await expect(page).toHaveTitle(/Search - Trustroots/);
  });

  test('Community Notes search filter toggles and persists', async ({
    browser,
    baseURL,
  }) => {
    await withSeededMemberPage(browser, baseURL, async page => {
      await installNostrRelayStub(page);
      await page.goto('/search');

      const filterLabel = page
        .locator('.search-sidebar-filters label')
        .filter({ hasText: 'Community Notes' });
      const checkbox = filterLabel.locator('input[type="checkbox"]');

      await expect(filterLabel).toBeVisible();
      if (await checkbox.isChecked()) {
        await filterLabel.click();
        await expect(checkbox).not.toBeChecked();
      }

      await filterLabel.click();
      await expect(checkbox).toBeChecked();

      await page.reload();
      await expect(filterLabel).toBeVisible();
      await expect(checkbox).toBeChecked();

      await filterLabel.click();
      await expect(checkbox).not.toBeChecked();
    });
  });

  test('Community Notes sidebar opens the Nostroots action modal', async ({
    browser,
    baseURL,
  }) => {
    await withSeededMemberPage(browser, baseURL, async page => {
      await installNostrRelayStub(page);
      await page.goto('/search');
      await showCommunityNotesSidebar(page);

      const sidebar = page.locator('.community-notes-sidebar');
      await expect(sidebar).toBeVisible();
      await expect(
        sidebar.getByRole('heading', { name: /Community Notes/ }),
      ).toBeVisible();
      await expect(sidebar.getByText(communityNotePlusCode)).toBeVisible();
      await expect(sidebar.getByText(communityNoteText)).toBeVisible();
      await expect(sidebar.getByText('via Nostroots')).toBeVisible();

      await sidebar.getByRole('button', { name: 'Reply' }).click();

      const dialog = page.getByRole('dialog', { name: 'Get Nostroots' });
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole('link', { name: 'Join TestFlight for iOS' }),
      ).toBeVisible();
      await expect(
        dialog.getByRole('link', { name: 'Download for Android' }),
      ).toBeVisible();
      await expect(
        dialog.getByRole('link', { name: 'Open web app' }),
      ).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    });
  });

  test('search members page loads', async ({ page }) => {
    await page.goto('/search/members');

    await expect(page).toHaveURL(/\/search\/members/);
    await expect(page).toHaveTitle(/Search members - Trustroots/);
  });

  test('search members page finds seeded hosts', async ({ page }) => {
    await page.goto('/search/members');

    await page
      .locator('#search-users-form input')
      .fill(SEEDED_MEMBERS[0].username);
    const searchResponse = page.waitForResponse(
      response =>
        response.url().includes('/api/users?search=') &&
        response.request().method() === 'GET' &&
        response.ok(),
    );
    await page.locator('#search-users-form button[type="submit"]').click();
    await searchResponse;
    await expect(
      page.getByRole('link', {
        name: `${SEEDED_MEMBERS[0].firstName} ${SEEDED_MEMBERS[0].lastName}`,
        exact: true,
      }),
    ).toBeVisible();
  });

  test('inbox prompts an unconfirmed member to activate their profile', async ({
    page,
  }) => {
    await page.goto('/messages');

    await expect(page).toHaveURL(/\/messages/);
    await expect(
      page.getByText(/activate your profile by confirming your email/i),
    ).toBeVisible();
  });

  test('profile edit "about" form is reachable', async ({ page }) => {
    await page.goto('/profile/edit');

    await expect(page).toHaveURL(/\/profile\/edit/);
    await expect(page.getByText(/describe yourself/i)).toBeVisible();
  });

  test('profile edit account page is reachable', async ({ page }) => {
    await page.goto('/profile/edit/account');

    await expect(page).toHaveURL(/\/profile\/edit\/account/);
    await expect(page).toHaveTitle(/Account - Trustroots/);
  });

  test('member can view their own profile', async ({ page }) => {
    await page.goto(`/profile/${user.username}`);

    await expect(page).toHaveURL(new RegExp(`/profile/${user.username}`));
    await expect(page).toHaveTitle(/Profile - Trustroots/);
    await expect(page.locator('.row.hidden-xs h2.profile-name')).toHaveText(
      `${user.firstName} ${user.lastName}`,
    );
  });

  test('member can view a seeded host profile', async ({
    browser,
    baseURL,
  }) => {
    const host = SEEDED_MEMBERS[1];
    const seededMemberContext = await browser.newContext({
      baseURL,
      storageState: seededMemberStoragePath,
    });
    const seededMemberPage = await seededMemberContext.newPage();

    try {
      await seededMemberPage.goto(`/profile/${host.username}`);

      await expect(seededMemberPage).toHaveURL(
        new RegExp(`/profile/${host.username}`),
      );
      await expect(
        seededMemberPage.locator('.row.hidden-xs h4.profile-username'),
      ).toHaveText(`@${host.username}`);
    } finally {
      await seededMemberContext.close();
    }
  });

  test('profile edit locations page is reachable', async ({ page }) => {
    await page.goto('/profile/edit/locations');

    await expect(page).toHaveURL(/\/profile\/edit\/locations/);
    await expect(page.getByText(/where do you live/i)).toBeVisible();
  });

  test('statistics page loads for a signed in member', async ({ page }) => {
    await page.goto('/statistics');

    await expect(page).toHaveURL(/\/statistics/);
    await expect(page).toHaveTitle(/Statistics - Trustroots/);
  });

  test('profile edit networks page is reachable', async ({ page }) => {
    await page.goto('/profile/edit/networks');

    await expect(page).toHaveURL(/\/profile\/edit\/networks/);
    await expect(page.locator('#nostrNpub')).toBeVisible();
  });

  test('logged in member can browse circles while unconfirmed', async ({
    page,
  }) => {
    await page.goto('/circles');
    await waitForTribesList(page);

    await expect(
      page.locator('h3.tribe-label', { hasText: 'Hitchhikers' }),
    ).toBeVisible();
  });

  test('regular members are turned away from admin tools', async ({ page }) => {
    page.once('dialog', dialog => dialog.accept());

    await page.goto('/admin/search-users');

    await expect(page).toHaveURL(/\/volunteering/);
  });

  test('profile edit photo page is reachable', async ({ page }) => {
    await page.goto('/profile/edit/photo');

    await expect(page).toHaveURL(/\/profile\/edit\/photo/);
    await expect(page).toHaveTitle(/Edit profile photo - Trustroots/);
    await expect(page.getByText(/profile photo/i).first()).toBeVisible();
  });

  test('navigation page lists member shortcuts', async ({ page }) => {
    await page.goto('/navigation');

    await expect(page).toHaveURL(/\/navigation/);
    await expect(page).toHaveTitle(/Navigation - Trustroots/);
    await expect(page.getByText(/view your profile/i)).toBeVisible();
    await expect(page.getByText(/edit profile/i).first()).toBeVisible();
    await expect(
      page.getByRole('link', { name: /find people/i }),
    ).toBeVisible();
  });

  test('member can sign out', async ({ browser, baseURL }) => {
    // Sign out tears down the session, so run it against a throwaway account in
    // an isolated context. That keeps the shared authenticated session intact
    // for the other tests in this file when they run in parallel.
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    try {
      const throwaway = createUser();
      await registerViaApi(context.request, throwaway);
      await signInViaApi(page, context.request, throwaway);

      await signOut(page);

      await page.goto('/messages');
      await expect(page).toHaveURL(/\/signin/);
    } finally {
      await context.close();
    }
  });
});
