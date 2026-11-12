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
    const sanitised = sanitiseRichText(content);
    const html = allowLinks
      ? sanitised
      : disableUserContentLinks(sanitised, allowTrustrootsLinks);
    return hashtagLinks?.size ? linkHashtags(html, hashtagLinks) : html;
  }, [content, allowLinks, allowTrustrootsLinks, hashtagLinks]);
  // DOMPurify sanitises user content. Generated destinations come from application code.
  // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
  return <div {...props} dangerouslySetInnerHTML={{ __html: html }} />;
}
