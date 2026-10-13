import React, { useMemo } from 'react';
import { sanitiseRichText } from '../utils/rich-text';

type RichTextProps = Omit<
  React.ComponentProps<'div'>,
  'children' | 'dangerouslySetInnerHTML'
> & {
  content: string;
  internalLinksOnly?: boolean;
};

export default function RichText({
  content,
  internalLinksOnly = false,
  ...props
}: RichTextProps) {
  const html = useMemo(
    () => sanitiseRichText(content, internalLinksOnly),
    [content, internalLinksOnly],
  );
  return <div {...props} dangerouslySetInnerHTML={{ __html: html }} />;
}
