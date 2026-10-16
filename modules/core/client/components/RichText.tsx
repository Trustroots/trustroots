import React, { useMemo } from 'react';
import { sanitiseRichText, disableUserContentLinks } from '../utils/rich-text';

type RichTextProps = Omit<
  React.ComponentProps<'div'>,
  'children' | 'dangerouslySetInnerHTML'
> & {
  content: string;
};

export default function RichText({ content, ...props }: RichTextProps) {
  const html = useMemo(
    () => disableUserContentLinks(sanitiseRichText(content)),
    [content],
  );
  return <div {...props} dangerouslySetInnerHTML={{ __html: html }} />;
}
