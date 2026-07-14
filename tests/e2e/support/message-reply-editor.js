/* global CompositionEvent, document, window */

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

  expect(
    await editor.evaluate(element =>
      Array.from(element.childNodes, node => node.textContent),
    ),
  ).toEqual(['one two three', 'four five ten', 'six seven', 'eight nine']);

  await editor.evaluate(element => {
    const line = element.childNodes[1];
    const target = line.firstChild || line;
    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(target, target.textContent.length);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    element.dispatchEvent(
      new CompositionEvent('compositionstart', { bubbles: true }),
    );
    document.execCommand('insertText', false, 'ê');
    element.dispatchEvent(
      new CompositionEvent('compositionend', { bubbles: true, data: 'ê' }),
    );
  });

  expect(
    await editor.evaluate(element =>
      Array.from(element.childNodes, node => node.textContent),
    ),
  ).toEqual(['one two three', 'four five tenê', 'six seven', 'eight nine']);
}

module.exports = {
  assertReplyComposerCaretAndComposition,
};
