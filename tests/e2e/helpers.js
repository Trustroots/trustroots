const { expect } = require('@playwright/test');

const DEFAULT_PASSWORD = 'Tester123';

// Confirmed members created by scripts/e2e/seed.js before Playwright runs.
const SEEDED_MEMBERS = [
  {
    username: 'e2e-seeded-berlin',
    email: 'e2e-seeded-berlin@example.test',
    password: DEFAULT_PASSWORD,
    firstName: 'Berlin',
    lastName: 'Host',
  },
  {
    username: 'e2e-seeded-portland',
    email: 'e2e-seeded-portland@example.test',
    password: DEFAULT_PASSWORD,
    firstName: 'Portland',
    lastName: 'Host',
  },
  {
    username: 'e2e-seeded-beijing',
    email: 'e2e-seeded-beijing@example.test',
    password: DEFAULT_PASSWORD,
    firstName: 'Beijing',
    lastName: 'Host',
  },
];

const SEEDED_ADMIN = {
  username: 'e2e-seeded-admin',
  email: 'e2e-seeded-admin@example.test',
  password: DEFAULT_PASSWORD,
  firstName: 'E2E',
  lastName: 'Admin',
};

const SEEDED_SHADOW = {
  username: 'e2e-seeded-shadow',
  email: 'e2e-seeded-shadow@example.test',
  password: DEFAULT_PASSWORD,
  firstName: 'Shadow',
  lastName: 'Spammer',
};

const SEEDED_CONVERSATIONS = {
  berlinPortland: {
    latestReply: 'Yes, happy to host you!',
    openingMessage: 'Hi Berlin host, are you available next week?',
  },
};

const SEEDED_SHADOW_MESSAGE = 'Hidden outreach from shadowbanned member';

const SEEDED_EXPERIENCE = {
  profileUsername: 'e2e-seeded-portland',
  feedbackPublic:
    'E2E seeded experience: Portland was a welcoming host on my trip.',
  summary: 'One member shared their experience and they recommended them.',
};

const SEEDED_PROFILE_DESCRIPTION = 'Seeded member profile for end-to-end tests';

const SEEDED_OFFER = {
  description: 'E2E seeded host offer',
  hostingStatus: 'Can host',
  maxGuestsLabel: 'At most 2 guests.',
};

const EUROPE_OFFERS_QUERY =
  '?northEastLat=55.31212135084999' +
  '&northEastLng=18.73318142361111' +
  '&southWestLat=44.66407507240992' +
  '&southWestLng=3.689914279513889';

/**
 * Build a unique user payload for signing up through the UI. Usernames and
 * emails are namespaced per call so specs can run back-to-back against the same
 * database without colliding.
 */
function createUser(overrides = {}) {
  const unique = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  return {
    firstName: 'Eddie',
    lastName: 'Endtoend',
    username: `e2e-${unique}`,
    email: `e2e-${unique}@example.test`,
    password: DEFAULT_PASSWORD,
    ...overrides,
  };
}

/**
 * Register a new member by calling the signup API directly. Useful for setting
 * up authentication state without driving the multi-step signup UI. Returns the
 * created user payload.
 */
async function registerViaApi(request, user, { attempts = 3 } = {}) {
  let lastDetail = 'no attempts made';

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await request.post('/api/auth/signup', {
      data: {
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        password: user.password,
      },
    });

    if (response.ok()) {
      return response.json();
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
}

/**
 * Register a new member through the multi-step signup UI. Leaves the browser on
 * the signup success step where the freshly created account is already
 * authenticated.
 *
 * The "circles" step (step 2) lists seeded tribe suggestions. We wait for the
 * always-present "Skip" button to confirm we reached the step.
 */
async function signUp(page, user) {
  await page.goto('/signup');

  await page.locator('#firstName').fill(user.firstName);
  await page.locator('#lastName').fill(user.lastName);
  await page.locator('#email').fill(user.email);
  await page.locator('#username').fill(user.username);
  await page.locator('#password').fill(user.password);
  await page.locator('#acquisitionStory').fill('End-to-end test');

  const signupResponse = page.waitForResponse(
    response =>
      response.url().includes('/api/auth/signup') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /^next$/i }).click();

  const response = await signupResponse;
  expect(
    response.ok(),
    `Signup responded with ${response.status()}: ${await response.text()}`,
  ).toBeTruthy();

  const skipButton = page.getByRole('button', { name: /^skip$/i });
  await expect(skipButton).toBeVisible();
  await skipButton.click();

  await expect(page.locator('#signup-edit')).toBeVisible();
}

/**
 * Sign in through the API and open the search page so the browser context
 * picks up the session cookie. Used by Playwright setup projects.
 */
async function signInViaApi(page, request, user) {
  const response = await request.post('/api/auth/signin', {
    data: {
      username: user.username,
      password: user.password,
    },
  });

  expect(
    response.ok(),
    `Signin API responded with ${response.status()}: ${await response.text()}`,
  ).toBeTruthy();

  await page.goto('/search');
  await expect(page).toHaveURL(/\/search/);
}

/**
 * Sign in through the UI with either a username or an email address and wait
 * for the post-login redirect to the search page.
 */
async function signIn(page, user, identifier = user.username) {
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
async function signOut(page) {
  await page.goto('/api/auth/signout');
  await expect(page).toHaveURL(/\/$/);
}

/**
 * Wait until the circles page has loaded tribe data from the API.
 */
async function waitForTribesList(page) {
  const response = await page.waitForResponse(
    apiResponse =>
      apiResponse.url().includes('/api/tribes') && apiResponse.ok(),
    { timeout: 30000 },
  );

  expect(response.ok()).toBeTruthy();

  const tribes = await response.json();
  expect(Array.isArray(tribes)).toBeTruthy();
  expect(
    tribes.length,
    'Circles API returned no tribes; is the e2e database seeded?',
  ).toBeGreaterThan(0);
}

/**
 * Look up a seeded member's Mongo id via the public profile API.
 */
async function fetchUserIdByUsername(request, username) {
  const response = await request.get(`/api/users/${username}`);
  expect(
    response.ok(),
    `Profile API responded with ${response.status()}: ${await response.text()}`,
  ).toBeTruthy();

  const profile = await response.json();
  return profile._id;
}

module.exports = {
  DEFAULT_PASSWORD,
  SEEDED_MEMBERS,
  SEEDED_ADMIN,
  SEEDED_SHADOW,
  SEEDED_CONVERSATIONS,
  SEEDED_SHADOW_MESSAGE,
  SEEDED_EXPERIENCE,
  SEEDED_PROFILE_DESCRIPTION,
  SEEDED_OFFER,
  EUROPE_OFFERS_QUERY,
  createUser,
  registerViaApi,
  signUp,
  signInViaApi,
  signIn,
  signOut,
  waitForTribesList,
  fetchUserIdByUsername,
};
