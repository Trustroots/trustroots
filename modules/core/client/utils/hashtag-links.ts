// Skip hashes embedded in words and URL fragments.
const hashtag = /(?<![\p{L}\p{N}\p{M}_#:/?&=.%@-])#([\p{L}\p{N}\p{M}_-]+)/gu;

export function* findHashtagLinks(
  text: string,
  links: ReadonlyMap<string, string>,
  limit = text.length,
) {
  for (const match of text.matchAll(hashtag)) {
    const [label, slug] = match;
    const start = match.index;
    const end = start + label.length;
    if (end > limit) break;

    const href = links.get(slug.toLowerCase());
    if (href) yield { label, href, start, end };
  }
}
