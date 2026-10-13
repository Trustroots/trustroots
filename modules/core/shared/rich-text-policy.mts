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
