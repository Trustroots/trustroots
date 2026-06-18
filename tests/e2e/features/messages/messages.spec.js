const { test, expect } = require('../../support/test');

const {
  SEEDED_CONVERSATIONS,
  SEEDED_MEMBERS,
  SEEDED_SHADOW,
  SEEDED_SHADOW_MESSAGE,
  fetchUserIdByUsername,
  signInViaApi,
} = require('../../support/helpers');

test.describe('seeded message flows', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, SEEDED_MEMBERS[0]);
  });

  test('inbox lists the seeded conversation with Portland Host', async ({
    page,
  }) => {
    await page.goto('/messages');

    await expect(page).toHaveURL(/\/messages/);
    await expect(page.getByText('Portland Host').first()).toBeVisible();
  });

  test('thread view shows the seeded reply', async ({ page, request }) => {
    const portland = SEEDED_MEMBERS[1];
    const portlandId = await fetchUserIdByUsername(request, portland.username);

    await page.goto(`/messages/${portland.username}?userId=${portlandId}`);

    await expect(
      page.getByText(SEEDED_CONVERSATIONS.berlinPortland.latestReply),
    ).toBeVisible();
    await expect(
      page.getByText(SEEDED_CONVERSATIONS.berlinPortland.openingMessage),
    ).toBeVisible();
  });

  test('inbox does not list the shadowbanned sender', async ({ page }) => {
    await page.goto('/messages');

    await expect(page.getByText(SEEDED_SHADOW.firstName)).toHaveCount(0);
    await expect(page.getByText(SEEDED_SHADOW_MESSAGE)).toHaveCount(0);
  });

  test('member thread API hides shadow-hidden messages from the recipient', async ({
    request,
  }) => {
    const response = await request.get(`/api/messages/${SEEDED_SHADOW.id}`);
    expect(response.ok()).toBeTruthy();

    const messages = await response.json();
    const contents = messages.map(message => message.content);
    expect(contents).not.toContain(SEEDED_SHADOW_MESSAGE);
  });
});
