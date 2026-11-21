import { Autolinker } from 'autolinker';
import React, { useMemo } from 'react';
import {
  sanitiseRichText,
  disableUserContentLinks,
  linkHashtags,
} from '../utils/rich-text';

type RichTextProps = Omit<
  React.ComponentProps<'div'>,
  'children' | 'dangerouslySetInnerHTML'
> & {
  content: string;
  allowTrustrootsLinks?: boolean;
  allowLinks?: boolean;
  hashtagLinks?: ReadonlyMap<string, string>;
};

export default function RichText({
  content,
  allowTrustrootsLinks = false,
  allowLinks = false,
  hashtagLinks,
  ...props
}: RichTextProps) {
  const html = useMemo(() => {
    const linked = allowLinks
      ? Autolinker.link(content, {
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
      : content;
    const sanitised = sanitiseRichText(linked);
    const html = allowLinks
      ? sanitised
      : disableUserContentLinks(sanitised, allowTrustrootsLinks);
    return hashtagLinks?.size ? linkHashtags(html, hashtagLinks) : html;
  }, [content, allowLinks, allowTrustrootsLinks, hashtagLinks]);
  // DOMPurify sanitises user content. Generated destinations come from application code.
  // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
  return <div {...props} dangerouslySetInnerHTML={{ __html: html }} />;
}
