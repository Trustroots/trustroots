import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  formatMessage,
  messageExcerpt,
  messagePlainText,
  sanitiseMessageHtml,
} from '../../../server/services/message-format.server.service.mts';

describe('message formatting', () => {
  it.each([
    '<p>First</p><p><br></p><p>Second<br>Third</p>',
    '<div>First</div><div><br></div><div>Second<br>Third</div>',
    '<div>First</div><div><div><br></div></div><div>Second<br>Third</div>',
    '<p>First</p><p><b><br></b></p><p>Second<br>Third</p>',
    '<div>First<div><br></div><div>Second<br>Third</div></div>',
    'First\n\nSecond\nThird',
    'First\r\n\r\nSecond\rThird',
  ])('preserves line boundaries in %s', input => {
    const stored = formatMessage(input);
    assert.equal(messagePlainText(stored), 'First\n\nSecond\nThird');
    assert.equal(sanitiseMessageHtml(stored), stored);
  });

  it.each([
    '<p>First<br></p><p><br></p><p>Second<br>Third</p>',
    'First<br><br><p>Second<br>Third</p>',
    '<div><p>First<br><br></p></div><p>Second<br>Third</p>',
  ])('counts an adjacent break and block boundary only once in %s', input => {
    assert.equal(
      messagePlainText(formatMessage(input)),
      'First\n\nSecond\nThird',
    );
  });

  it.each(['<p>First<br />\n  Second</p>', '<p>First\n  <br />Second</p>'])(
    'ignores one source newline beside an explicit HTML break in %s',
    input => {
      assert.equal(messagePlainText(formatMessage(input)), 'First\nSecond');
    },
  );

  it('trims empty edge lines and keeps HTML indentation out of the body', () => {
    const stored = sanitiseMessageHtml(
      '\n<p><br></p>\n  <p><br>First</p>\n  <p></p>\n  <p>Second<br></p>\n',
    );
    assert.equal(stored, '<p>First</p><p><br /></p><p>Second</p>');
    assert.equal(messagePlainText(stored), 'First\n\nSecond');
    assert.equal(formatMessage('<div><br></div><p>&nbsp;</p>\r\n'), '');
  });

  it('keeps literal markup and line separators readable in inbox excerpts', () => {
    assert.equal(
      messageExcerpt('<p>First</p><p><br></p><p>&amp;lt;entry&amp;gt;</p>'),
      'First <entry>',
    );
    assert.equal(messageExcerpt('A'.repeat(101)).length, 100);
  });

  it('keeps hosting markers, safe links, formatting and literal markup', () => {
    const stored = formatMessage(
      '<p data-hosting="yes"><strong>First</strong> &lt;item&gt;</p><p><a href="/safety">Safety</a></p><script>ignored</script>',
    );
    assert.equal(
      stored,
      '<p data-hosting="yes"><b>First</b> &lt;item&gt;</p><p><a href="/safety">Safety</a></p>',
    );
    assert.equal(messagePlainText(stored), 'First <item>\nSafety');
    assert.equal(
      messagePlainText(stored, true),
      'First <item>\nSafety /safety',
    );
  });
});
