const {
  annotateFeature,
  test,
  expect,
  useElementScreenshot,
} = require('../../support/test');

const {
  SEEDED_MEMBERS,
  createUser,
  registerViaApi,
  signOut,
  signUp,
} = require('../../support/helpers');

const user = createUser();

async function signInExisting(page, usernameOrEmail) {
  await page.goto('/signin');
  await page.locator('#username').fill(usernameOrEmail);
  await page.locator('#password').fill(user.password);
  await page.getByRole('button', { name: /login/i }).click();
  await expect(page).toHaveURL(/\/search/);
}

test.describe.serial('authentication smoke', () => {
  test.beforeAll(async ({ request }) => {
    await registerViaApi(request, user);
  });

  test('homepage loads and exposes authentication entry points', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'public.home', [
      'Homepage loads for visitors.',
      'Sign in and sign up entry points are visible.',
      'Homepage footer links to public statistics.',
      'Homepage footer links to safety guidance.',
      'Optional circle/tribe query parameters do not break the page.',
    ]);

    await page.goto('/');

    await expect(page).toHaveTitle(/Trustroots/);
    await expect(page.locator('a[href="/signup"]').first()).toBeVisible();
    await expect(page.locator('a[href="/signin"]').first()).toBeVisible();
    await expect(
      page.locator('.home-footer-pages a[href="/statistics"]'),
    ).toHaveText('Statistics');
    await expect(
      page.locator('.home-footer-pages a[href="/safety"]'),
    ).toHaveText('Safety');
  });

  test('signup submits a unique user through the UI', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.signup', [
      'Signup form validates required fields.',
      'Signup succeeds for a unique user.',
      'Signup can preload suggested circles from the tribe query parameter.',
    ]);

    const signupUser = createUser();

    await page.route('**/api/auth/signup', async route => {
      const payload = route.request().postDataJSON();

      expect(payload).toMatchObject({
        email: signupUser.email,
        firstName: signupUser.firstName,
        lastName: signupUser.lastName,
        password: signupUser.password,
      });

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          _id: 'e2e-signup-user',
          displayName: `${signupUser.firstName} ${signupUser.lastName}`,
          email: signupUser.email,
          firstName: signupUser.firstName,
          lastName: signupUser.lastName,
          public: false,
          username: signupUser.username,
        }),
      });
    });

    await signUp(page, signupUser);
  });

  test('signup uses the Trustroots primary colour', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.signup', [
      'Signup form validates required fields.',
    ]);
    useElementScreenshot(testInfo, '.signup-form-steps');

    await page.goto('/signup');
    await expect(
      page.getByRole('button', { name: 'Please fill in the form' }),
    ).toHaveCSS('background-color', 'rgb(18, 181, 145)');
  });

  test('UI signup creates an account that can sign in with username and email', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.signup', [
      'Signup succeeds for a unique user.',
    ]);

    const member = createUser();
    await signUp(page, member);
    await signOut(page);
    await signInExisting(page, member.username);
    await signOut(page);
    await signInExisting(page, member.email);
  });

  test('signup rejects reserved service names', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.signup', [
      'Signup form validates required fields.',
    ]);
    const member = createUser();
    await page.goto('/signup');
    await page.locator('#firstName').fill(member.firstName);
    await page.locator('#lastName').fill(member.lastName);
    await page.locator('#email').fill(member.email);
    await page.locator('#password').fill(member.password);
    const validationResponse = page.waitForResponse(
      response =>
        response.url().endsWith('/api/auth/signup/validate') &&
        response.request().postDataJSON().username === 'nostr',
    );
    await page.locator('#username').fill('nostr');
    await page.locator('#username').blur();
    expect(await (await validationResponse).json()).toMatchObject({
      valid: false,
      message: 'Username is not available.',
    });
    await expect(
      page.getByText('Username is not available.', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Please fill in the form' }),
    ).toBeDisabled();
    const rejected = await request.post('/api/auth/signup', {
      data: { ...member, username: 'nostr' },
    });
    expect(rejected.status()).toBe(400);
    await page.locator('#username').fill(member.username);
    await page.locator('#username').blur();
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  test('signup explains underscores and waits for username validation', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.signup', [
      'Signup form validates required fields.',
    ]);
    const member = createUser();
    let releaseValidation;
    const validationGate = new Promise(resolve => {
      releaseValidation = resolve;
    });
    await page.route('**/api/auth/signup/validate', async route => {
      await validationGate;
      await route.continue();
    });
    await page.goto('/signup');
    await page.locator('#firstName').fill(member.firstName);
    await page.locator('#lastName').fill(member.lastName);
    await page.locator('#email').fill(member.email);
    await page.locator('#password').fill(member.password);
    await page.locator('#username').fill('sample_member');
    await expect(
      page.getByRole('button', { name: 'Please fill in the form' }),
    ).toBeDisabled();
    await page.locator('#username').blur();
    await expect(
      page
        .getByText(
          'Use 3-34 letters, numbers, periods or hyphens. Underscores are not allowed at signup.',
        )
        .first(),
    ).toBeVisible();
    const rejected = await request.post('/api/auth/signup', {
      data: { ...member, username: 'sample_member' },
    });
    expect(rejected.status()).toBe(400);
    expect((await rejected.json()).message).toContain(
      'Underscores are not allowed at signup.',
    );
    await page.locator('#username').fill(member.username);
    try {
      await expect(
        page.getByRole('button', { name: 'Checking username…' }),
      ).toBeDisabled();
    } finally {
      releaseValidation();
    }
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  test('signed out user can sign in with username', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.signin', [
      'Sign in page links to signup.',
      'Username sign in succeeds.',
      'Email sign in succeeds.',
      'Continue query redirects to the original protected destination.',
    ]);

    await signOut(page);
    await signInExisting(page, user.username);
  });

  test('signed out user can sign in with email', async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'auth.signin', [
      'Sign in page links to signup.',
      'Username sign in succeeds.',
      'Email sign in succeeds.',
      'Continue query redirects to the original protected destination.',
    ]);

    await signOut(page);
    await signInExisting(page, user.email);
  });

  test('sign-in continues to the protected destination', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.protected-route-redirect', [
      'Protected routes preserve their path and query when redirecting to sign in.',
    ]);

    await signOut(page);
    await page.goto('/messages?filter=unread');
    await expect(page).toHaveURL(
      /\/signin\?continue=true&returnTo=%2Fmessages%3Ffilter%3Dunread/,
    );

    const confirmedMember = SEEDED_MEMBERS[0];
    await page.locator('#username').fill(confirmedMember.username);
    await page.locator('#password').fill(confirmedMember.password);
    await page.getByRole('button', { name: /sign in to continue/i }).click();

    await expect(page).toHaveURL(/\/messages\?filter=unread/);
  });
});
