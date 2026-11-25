import { Autolinker } from 'autolinker';
import React, { useMemo } from 'react';
import {
  sanitiseRichText,
  disableUserContentLinks,
  linkHashtags,
  linkMarkdown,
} from '../utils/rich-text';

type RichTextProps = Omit<
  React.ComponentProps<'div'>,
  'children' | 'dangerouslySetInnerHTML'
> & {
  content: string;
  messageFormatting?: boolean;
  allowTrustrootsLinks?: boolean;
  allowLinks?: boolean;
  allowMarkdownLinks?: boolean;
  hashtagLinks?: ReadonlyMap<string, string>;
};

export default function RichText({
  content,
  messageFormatting = false,
  allowTrustrootsLinks = false,
  allowLinks = false,
  allowMarkdownLinks = false,
  hashtagLinks,
  ...props
}: RichTextProps) {
  const html = useMemo(() => {
    // Resolve labelled links before Autolinker sees their destinations as bare URLs.
    const source =
      allowLinks && allowMarkdownLinks
        ? linkMarkdown(sanitiseRichText(content, messageFormatting))
        : content;
    const linked = allowLinks
      ? Autolinker.link(source, {
          email: false,
          phone: false,
          decodePercentEncoding: false,
          stripPrefix: false,
          stripTrailingSlash: false,
          newWindow: false,
          replaceFn(match) {
            if (/^https?:\/\//i.test(match.getMatchedText())) return true;
            const href = match.getAnchorHref();
            if (!href.startsWith('http://')) return false;
            return match.buildTag().setAttr('href', 'https://' + href.slice(7));
          },
        })
      : source;
    const sanitised = sanitiseRichText(linked, messageFormatting);
    const html = allowLinks
      ? sanitised
      : disableUserContentLinks(sanitised, allowTrustrootsLinks);
    return hashtagLinks?.size ? linkHashtags(html, hashtagLinks) : html;
  }, [
    content,
    allowLinks,
    allowMarkdownLinks,
    allowTrustrootsLinks,
    hashtagLinks,
    messageFormatting,
  ]);
  // DOMPurify sanitises user content. Generated destinations come from application code.
  // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
  return <div {...props} dangerouslySetInnerHTML={{ __html: html }} />;
}
