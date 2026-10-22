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
  return <div {...props} dangerouslySetInnerHTML={{ __html: html }} />;
}
