import React, { useMemo } from 'react';
import { sanitiseRichText, disableUserContentLinks } from '../utils/rich-text';

type RichTextProps = Omit<
  React.ComponentProps<'div'>,
  'children' | 'dangerouslySetInnerHTML'
> & {
  content: string;
  allowTrustrootsLinks?: boolean;
};

export default function RichText({
  content,
  allowTrustrootsLinks = false,
  ...props
}: RichTextProps) {
  const html = useMemo(
    () =>
      disableUserContentLinks(sanitiseRichText(content), allowTrustrootsLinks),
    [content, allowTrustrootsLinks],
  );
  return <div {...props} dangerouslySetInnerHTML={{ __html: html }} />;
}
