import {
  expect,
  type APIRequestContext,
  type APIResponse,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
  type Response as PlaywrightResponse,
} from '@playwright/test';
import {
  CONVERSATIONS,
  E2E_PASSWORD,
  MEMBERS,
  SHADOW_MESSAGES,
} from '../../../scripts/e2e/data.mts';

export type SeededMember = {
  id: string;
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

export type NewUser = Omit<SeededMember, 'id'> & { roles?: string[] };

export type CreateUserOverrides = Partial<NewUser>;

export type RegisteredUser = { _id: string };

export const DEFAULT_PASSWORD = E2E_PASSWORD;

// Confirmed members created by scripts/e2e/seed.js before Playwright runs.
const asTestMember = (username: string): SeededMember => {
  const member = MEMBERS.find(member => member.username === username);
  if (!member) {
    throw new Error(`Seeded member not found: ${username}`);
  }

  return {
    id: member.id,
    username: member.username,
    email: member.email,
    password: DEFAULT_PASSWORD,
    firstName: member.firstName,
    lastName: member.lastName,
  };
};

export const SEEDED_MEMBERS = [
  'e2e-seeded-berlin',
  'e2e-seeded-portland',
  'e2e-seeded-beijing',
].map(asTestMember);
export const SEEDED_ADMIN = asTestMember('e2e-seeded-admin');

export const SEEDED_RELATIONSHIP_MEMBERS: Record<
  'alice' | 'bob',
  SeededMember
> = {
  alice: asTestMember('e2e-seeded-alice'),
  bob: asTestMember('e2e-seeded-bob'),
};

export const SEEDED_SHADOW = asTestMember('e2e-seeded-shadow');

export const SEEDED_CONVERSATIONS = {
  berlinPortland: {
    latestReply: CONVERSATIONS[0].messages[1].content,
    openingMessage: CONVERSATIONS[0].messages[0].content,
  },
};

export const SEEDED_SHADOW_MESSAGE = SHADOW_MESSAGES[0].content;

export const SEEDED_EXPERIENCE = {
  profileUsername: 'e2e-seeded-portland',
  feedbackPublic:
    'E2E seeded experience: Portland was a welcoming host on my trip.',
  summary: 'One member shared their experience and they recommended them.',
};

export const SEEDED_PRIVATE_EXPERIENCE = {
  profileUsername: SEEDED_RELATIONSHIP_MEMBERS.bob.username,
  feedbackPublic: 'E2E seeded private experience for coverage.',
};

export const SEEDED_PROFILE_DESCRIPTION =
  'Seeded member profile for end-to-end tests';

export const SEEDED_OFFER = {
  description: 'E2E seeded host offer',
  hostingStatus: 'Can host',
  maxGuestsLabel: 'At most 2 guests.',
};

export const SEEDED_MEET_OFFER = {
  description: 'E2E seeded active meet offer',
  expiredDescription: 'E2E seeded expired meet offer',
};

export const EUROPE_OFFERS_QUERY =
  '?northEastLat=55.31212135084999' +
  '&northEastLng=18.73318142361111' +
  '&southWestLat=44.66407507240992' +
  '&southWestLng=3.689914279513889';

/**
 * Build a unique user payload for signing up through the UI. Usernames and
 * emails are namespaced per call so specs can run back-to-back against the same
 * database without colliding.
 */
export function createUser(overrides: CreateUserOverrides = {}): NewUser {
  const unique = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

  return {
    firstName: 'Eddie',
    lastName: 'Endtoend',
    username: `e2e${unique}`,
    email: `e2e${unique}@example.test`,
    password: DEFAULT_PASSWORD,
    ...overrides,
  };
}

/**
 * Create a browser context that cannot inherit a project's saved login.
 *
 * Authenticated Playwright projects configure a storage state globally. Tests
 * that create throwaway members must start from an empty cookie jar; otherwise
 * Passport can rotate and invalidate the shared project session during signup.
 */
export function createIsolatedContext(
  browser: Browser,
  baseURL: string | undefined,
  options: BrowserContextOptions = {},
): Promise<BrowserContext> {
  return browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
    ...options,
  });
}

/**
 * Register a new member by calling the signup API directly. Useful for setting
 * up authentication state without driving the multi-step signup UI. Returns the
 * created user payload.
 */
export async function registerViaApi(
  request: APIRequestContext,
  user: NewUser,
  { attempts = 3 }: { attempts?: number } = {},
): Promise<RegisteredUser> {
  let lastDetail = 'no attempts made';

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await request.post('/api/auth/signup', {
      // Signup authenticates the new member and Passport rotates any session
      // supplied with the request. Never let test setup rotate a project's
      // shared storage-state session.
      headers: { Cookie: '' },
      data: {
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        password: user.password,
      },
    });

    if (response.ok()) {
      const createdUser: unknown = await response.json();
      if (
        typeof createdUser !== 'object' ||
        createdUser === null ||
        !('_id' in createdUser) ||
        typeof createdUser._id !== 'string'
      ) {
        throw new Error(
          'Signup API response did not include a string user id.',
        );
      }
      return { _id: createdUser._id };
    }

    lastDetail = `${response.status()}: ${await response.text()}`;

    if (attempt < attempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  expect(
    null,
    `Signup API never succeeded. Last response ${lastDetail}`,
  ).toBeTruthy();
  throw new Error(`Signup API never succeeded. Last response ${lastDetail}`);
}

/**
 * Register a new member through the multi-step signup UI. Leaves the browser on
 * the signup success step where the freshly created account is already
 * authenticated.
 *
 * The "circles" step (step 2) lists seeded tribe suggestions. We wait for the
 * always-present "Skip" button to confirm we reached the step.
 */
export async function signUp(page: Page, user: NewUser): Promise<void> {
  await page.goto('/signup');

  await page.locator('#firstName').fill(user.firstName);
  await page.locator('#lastName').fill(user.lastName);
  await page.locator('#email').fill(user.email);
  await page.locator('#username').fill(user.username);
  await page.locator('#password').fill(user.password);

  const signupResponse = page.waitForResponse(
    response =>
      response.url().includes('/api/auth/signup') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /^next$/i }).click();

  const response = await signupResponse;
  let responseDetail = '';

  if (!response.ok()) {
    responseDetail = await response
      .text()
      .catch(() => 'Response body unavailable.');
  }

  expect(
    response.ok(),
    `Signup responded with ${response.status()}: ${responseDetail}`,
  ).toBeTruthy();

  const skipButton = page.getByRole('button', { name: /^skip$/i });
  await expect(skipButton).toBeVisible();
  await skipButton.click();

  await expect(page.locator('#signup-edit')).toBeVisible();
}

/**
 * Authenticate a request context without opening a browser page.
 */
export async function elevateAdminViaApi(
  request: APIRequestContext,
  password: string,
): Promise<APIResponse> {
  const response = await request.post('/api/admin/elevate', {
    data: { password },
  });
  expect(
    response.ok(),
    `Admin elevation responded with ${response.status()}: ${await response.text()}`,
  ).toBeTruthy();
  return response;
}

export async function authenticateViaApi(
  request: APIRequestContext,
  user: Pick<SeededMember, 'username' | 'password'> & { roles?: string[] },
): Promise<APIResponse> {
  const response = await request.post('/api/auth/signin', {
    data: { username: user.username, password: user.password },
  });
  expect(
    response.ok(),
    `Signin API responded with ${response.status()}: ${await response.text()}`,
  ).toBeTruthy();

  // Privileged browser sessions stay signed in as members; unlock admin APIs
  // with the same password so specs can exercise moderation tools.
  const responseJSON = await response.json().catch(() => null);
  const roles =
    responseJSON?.roles ||
    (responseJSON?.isGreeter ? ['welcome-team'] : user.roles || []);
  if (
    roles.includes('admin') ||
    roles.includes('welcome-team') ||
    roles.includes('support-team')
  ) {
    await elevateAdminViaApi(request, user.password);
  } else if (user.username === SEEDED_ADMIN.username) {
    await elevateAdminViaApi(request, user.password);
  }

  return response;
}

export async function signInViaApi(
  page: Page,
  request: APIRequestContext | undefined,
  user: Pick<SeededMember, 'username' | 'password'> & { roles?: string[] },
): Promise<void> {
  // A project storage state can be shared by many test contexts. Passport
  // regenerates the current session on login, so never send that shared cookie
  // with a test-specific sign-in request.
  await page.context().clearCookies();

  // Authenticate the supplied request fixture as well as the browser. Several
  // specs use it for API setup after signing in, while browser-context requests
  // alone do not refresh that fixture's cookie jar.
  const signInRequest = request || page.context().request;
  const response = await authenticateViaApi(signInRequest, user);

  const setCookie = response.headers()['set-cookie'];
  if (setCookie) {
    const [name, ...valueParts] = setCookie.split(';')[0].split('=');
    const cookieUrl = new URL(response.url()).origin;
    await page.context().addCookies([
      {
        name,
        value: valueParts.join('='),
        url: cookieUrl,
      },
    ]);
  }
}

/**
 * Sign in through the UI with either a username or an email address and wait
 * for the post-login redirect to the search page.
 */
export async function signIn(
  page: Page,
  user: Pick<SeededMember, 'username' | 'password'> & { roles?: string[] },
  identifier = user.username,
): Promise<void> {
  await page.goto('/signin');
  await page.locator('#username').fill(identifier);
  await page.locator('#password').fill(user.password);

  const signInResponse = page.waitForResponse(
    response => response.url().includes('/api/auth/signin') && response.ok(),
  );
  await page.getByRole('button', { name: /login/i }).click();
  await signInResponse;

  await expect(page).toHaveURL(/\/search/);
}

/**
 * Sign out via the API endpoint, which clears the session and redirects to the
 * homepage.
 */
export async function signOut(page: Page): Promise<void> {
  await page.goto('/');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.evaluate(() => {
      const form = document.createElement('form');
      form.method = 'post';
      form.action = '/api/auth/signout';
      document.body.appendChild(form);
      form.submit();
    }),
  ]);
  await expect(page).toHaveURL(/\/$/);
}

/**
 * Wait until the circles page has loaded tribe data from the API.
 */
export async function waitForTribesList(page: Page): Promise<void> {
  let response: APIResponse | PlaywrightResponse;
  try {
    response = await page.waitForResponse(
      apiResponse =>
        apiResponse.url().includes('/api/tribes') && apiResponse.ok(),
      { timeout: 5000 },
    );
  } catch {
    response = await page.request.get('/api/tribes', {
      params: { limit: 150 },
    });
  }

  expect(response.ok()).toBeTruthy();

  const tribes: unknown = await response.json();
  if (Array.isArray(tribes)) {
    expect(
      tribes.length,
      'Circles API returned no tribes; is the e2e database seeded?',
    ).toBeGreaterThan(0);
  } else {
    expect(Array.isArray(tribes)).toBeTruthy();
  }
  await expect(
    page.locator('a.tribe-link, h3.tribe-label').first(),
  ).toBeVisible();
}

/**
 * Look up a seeded member's Mongo id via the public profile API.
 */
export async function fetchUserIdByUsername(
  request: APIRequestContext,
  username: string,
): Promise<string> {
  const response = await request.get(`/api/users/${username}`);
  expect(
    response.ok(),
    `Profile API responded with ${response.status()}: ${await response.text()}`,
  ).toBeTruthy();

  const profile: unknown = await response.json();
  if (
    typeof profile !== 'object' ||
    profile === null ||
    !('_id' in profile) ||
    typeof profile._id !== 'string'
  ) {
    throw new Error(`Profile API returned no string id for ${username}.`);
  }
  return profile._id;
}
