/* global CompositionEvent, document */

const { expect } = require('./test');

async function assertReplyComposerCaretAndComposition(page, threadUrl) {
  await page.goto(threadUrl);

  const editor = page.locator('#message-reply-content');
  await editor.click();
  for (const [index, line] of [
    'one two three',
    'four five',
    'six seven',
    'eight nine',
  ].entries()) {
    await page.keyboard.insertText(line);
    if (index < 3) {
      await page.keyboard.press('Enter');
    }
  }

  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('End');
  await page.keyboard.insertText(' ten');

  const visibleLines = () =>
    editor.evaluate(element =>
      element.innerText.split(/\n+/).filter(line => line.length > 0),
    );

  expect(await visibleLines()).toEqual([
    'one two three',
    'four five ten',
    'six seven',
    'eight nine',
  ]);

  await editor.evaluate(element => {
    element.dispatchEvent(
      new CompositionEvent('compositionstart', { bubbles: true }),
    );
    document.execCommand('insertText', false, 'ê');
    element.dispatchEvent(
      new CompositionEvent('compositionend', { bubbles: true, data: 'ê' }),
    );
  });

  expect(await visibleLines()).toEqual([
    'one two three',
    'four five tenê',
    'six seven',
    'eight nine',
  ]);
}

module.exports = {
  assertReplyComposerCaretAndComposition,
};
