import React, { useMemo } from 'react';
import { sanitiseRichText, disableUserContentLinks } from '../utils/rich-text';

type RichTextProps = Omit<
  React.ComponentProps<'div'>,
  'children' | 'dangerouslySetInnerHTML'
> & {
  content: string;
  allowTrustrootsLinks?: boolean;
  allowLinks?: boolean;
};

export default function RichText({
  content,
  allowTrustrootsLinks = false,
  allowLinks = false,
  ...props
}: RichTextProps) {
  const html = useMemo(() => {
    const sanitised = sanitiseRichText(content);
    return allowLinks
      ? sanitised
      : disableUserContentLinks(sanitised, allowTrustrootsLinks);
  }, [content, allowLinks, allowTrustrootsLinks]);
  // html is produced by DOMPurify in sanitiseRichText; link handling only removes destinations.
  // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
  return <div {...props} dangerouslySetInnerHTML={{ __html: html }} />;
}
