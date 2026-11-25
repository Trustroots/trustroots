/** Formatting supported by descriptions, notes and messages. */
export const richTextTags = [
  'p',
  'br',
  'b',
  'i',
  'em',
  'strong',
  'u',
  'a',
  'li',
  'ul',
  'blockquote',
];

// Some browsers use divs for lines in contenteditable.
export const messageRichTextTags = [...richTextTags, 'div'];
export const messageLineBlockTags = new Set([
  'p',
  'div',
  'blockquote',
  'ul',
  'li',
]);

/** Prefer explicit HTML line boundaries over adjacent source indentation. */
export function normaliseMessageSourceNewlines(
  text: string,
  previousTag = '',
  nextTag = '',
): string {
  if (
    !text.trim() &&
    (messageLineBlockTags.has(previousTag) || messageLineBlockTags.has(nextTag))
  ) {
    return '';
  }
  if (previousTag === 'br') text = text.replace(/^[ \t]*\n/, '');
  if (nextTag === 'br') text = text.replace(/\n[ \t]*$/, '');
  return text;
}

export const richTextAttributes: Record<string, string[]> = {
  a: ['href'],
  p: ['data-hosting'],
};

export const richTextLinkSchemes = [
  'http',
  'https',
  'ftp',
  'sftp',
  'tel',
  'mailto',
  'geo',
  'irc',
  'ge0',
  'tg',
];
