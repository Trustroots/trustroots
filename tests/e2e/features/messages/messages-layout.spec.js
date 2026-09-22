/* global document, window */

const { annotateFeature, test, expect } = require('../../support/test');

const { SEEDED_MEMBERS, signInViaApi } = require('../../support/helpers');
const {
  assertReplyComposerCaretAndComposition,
} = require('../../support/message-reply-editor');

test.describe('message thread layout', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, SEEDED_MEMBERS[0]);
  });

  test('reply editor remains usable when long text overflows', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.reply-send', [
      'Reply composer remains usable when draft content overflows.',
    ]);

    const portland = SEEDED_MEMBERS[1];

    // Short desktop viewport that reproduces the Firefox overflow from #2722.
    await page.setViewportSize({ width: 1158, height: 407 });
    await page.goto(`/messages/${portland.username}`);

    const editor = page.locator('#message-reply-content');
    await expect(editor).toBeVisible();

    // A long conversation gives the scrollable message list a very large flex
    // base size. The composer must keep its own minimum height rather than
    // sharing that shrinkage with the message list (#2838).
    await page.locator('#message-reply').evaluate(form => {
      const longConversation = document.createElement('div');
      longConversation.style.height = '10000px';
      form.parentElement.firstElementChild.appendChild(longConversation);
    });

    const initialLayout = await page.evaluate(() => {
      const replyEditor = document.querySelector('#message-reply-content');
      const actions = document.querySelector('.message-reply-actions');

      return {
        actionsTop: actions.getBoundingClientRect().top,
        editorBottom: replyEditor.getBoundingClientRect().bottom,
        editorHeight: replyEditor.getBoundingClientRect().height,
      };
    });

    expect(initialLayout.editorHeight).toBeGreaterThanOrEqual(43);
    expect(initialLayout.editorBottom).toBeLessThanOrEqual(
      initialLayout.actionsTop,
    );

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

    // On narrow screens the send button is fixed to the viewport edge. A
    // viewport-height change (such as dismissing the Android keyboard) must not
    // leave only the top of the editor visible.
    await page.setViewportSize({ width: 360, height: 240 });
    const mobileLayout = await page.evaluate(() => {
      const viewportHeight = window.innerHeight;
      const replyEditor = document.querySelector('#message-reply-content');
      const sendButton = document.querySelector('#messageReplySubmit');

      return {
        editorBottom: replyEditor.getBoundingClientRect().bottom,
        editorHeight: replyEditor.getBoundingClientRect().height,
        sendButtonBottom: sendButton.getBoundingClientRect().bottom,
        viewportHeight,
      };
    });

    expect(mobileLayout.editorHeight).toBeGreaterThanOrEqual(43);
    expect(mobileLayout.editorBottom).toBeLessThanOrEqual(
      mobileLayout.viewportHeight,
    );
    expect(mobileLayout.sendButtonBottom).toBeLessThanOrEqual(
      mobileLayout.viewportHeight,
    );
  });

  test('reply composer preserves a multiline caret and composed characters', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.reply-send', [
      'Editing an earlier line does not move or reorder the reply text.',
      'Reply text retains characters entered through an input composition.',
    ]);

    const portland = SEEDED_MEMBERS[1];
    await assertReplyComposerCaretAndComposition(
      page,
      `/messages/${portland.username}`,
    );
  });
});
