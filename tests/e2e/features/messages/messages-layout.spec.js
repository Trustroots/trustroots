/* global document, window */

const { annotateFeature, test, expect } = require('../../support/test');

const {
  SEEDED_MEMBERS,
  fetchUserIdByUsername,
} = require('../../support/helpers');

test.describe('message thread layout', () => {
  test('reply editor remains usable when long text overflows', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.reply-send', [
      'Reply composer remains usable when draft content overflows.',
    ]);

    const portland = SEEDED_MEMBERS[1];
    const portlandId = await fetchUserIdByUsername(request, portland.username);

    // Short desktop viewport that reproduces the Firefox overflow from #2722.
    await page.setViewportSize({ width: 1158, height: 407 });
    await page.goto(`/messages/${portland.username}?userId=${portlandId}`);

    const editor = page.locator('#message-reply-content');
    await expect(editor).toBeVisible();

    await editor.fill(
      Array(30)
        .fill(
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque faucibus ex sapien vitae pellentesque sem placerat.',
        )
        .join('\n'),
    );

    await page.waitForFunction(() => {
      const replyEditor = document.querySelector('#message-reply-content');
      return replyEditor.scrollHeight > replyEditor.clientHeight;
    });

    const layout = await page.evaluate(() => {
      const viewportHeight = window.innerHeight;
      const form = document.querySelector('#message-reply');
      const replyEditor = document.querySelector('#message-reply-content');
      const sendButton = document.querySelector('#messageReplySubmit');

      return {
        editorBottom: replyEditor.getBoundingClientRect().bottom,
        formBottom: form.getBoundingClientRect().bottom,
        sendButtonBottom: sendButton.getBoundingClientRect().bottom,
        viewportHeight,
      };
    });

    expect(layout.editorBottom).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.formBottom).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.sendButtonBottom).toBeLessThanOrEqual(layout.viewportHeight);
  });
});
