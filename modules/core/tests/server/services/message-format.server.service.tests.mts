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

  it('omits HTML comments and includes each optional link destination once', () => {
    const markup =
      '<p><a href="/safety"></a></p><!-- ignored --><p><a href="/help">/help</a></p>';

    assert.equal(messagePlainText(markup), '/help');
    assert.equal(messagePlainText(markup, true), '/safety\n/help');
  });

  it('keeps a blank interior div with nested inline formatting', () => {
    assert.equal(
      formatMessage('<p>First</p><div>&nbsp;<b></b></div><p>Last</p>'),
      '<p>First</p><div> <b></b><br /></div><p>Last</p>',
    );
  });

  it('removes blank edges while preserving spacing next to text', () => {
    assert.equal(sanitiseMessageHtml('  A  '), 'A');
    assert.equal(sanitiseMessageHtml(' &nbsp;'), '');
    assert.equal(sanitiseMessageHtml('&nbsp;<p>B</p>'), '\u00a0<p>B</p>');
    assert.equal(sanitiseMessageHtml('<p>A </p><br> &nbsp;'), '<p>A </p>');
  });

  it('handles whitespace around nested line boundaries in plain text', () => {
    assert.equal(messagePlainText('A<br>B<p>C</p>'), 'A\nB\nC');
    assert.equal(messagePlainText('A \t B <br>C'), 'A B\nC');
    assert.equal(messagePlainText('<p>A</p> <p>B</p>'), 'A\nB');
    assert.equal(
      messagePlainText('<p>First</p><div><p></p> </div><p>Last</p>'),
      'First\n\nLast',
    );
    assert.equal(
      messagePlainText('<p>First</p><div><b><br></b>&nbsp;</div><p>Last</p>'),
      'First\n\n\nLast',
    );
  });

  it('adds destinations for anchors with an href', () => {
    assert.equal(messagePlainText('<p></p><a title="Hint">C</a>', true), 'C');
    assert.equal(messagePlainText('<b href="/ignored">Bold</b>', true), 'Bold');
  });

  it('adds bullets to list items in email text', () => {
    const markup = '<ul><li>First</li><li>Second</li></ul>';
    assert.equal(messagePlainText(markup), 'First\nSecond');
    assert.equal(messagePlainText(markup, true), '* First\n* Second');
  });

  it('trims excerpt spacing after decoding entities', () => {
    assert.equal(messageExcerpt('&amp;nbsp;A&amp;nbsp;'), 'A');
  });
});
