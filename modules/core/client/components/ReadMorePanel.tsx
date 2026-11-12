// External dependencies
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';

// Internal dependencies
import '@/config/client/i18n';
import { plainText, plainTextLength } from '../utils/filters';
import { findHashtagLinks } from '../utils/hashtag-links';
import RichText from './RichText';

const LIMIT = 2000;

type ReadMorePanelProps = {
  content: string;
  id: string;
  hashtagLinks?: ReadonlyMap<string, string>;
};

export default function ReadMorePanel({
  content,
  id,
  hashtagLinks,
}: ReadMorePanelProps) {
  const [showMore, setShowMore] = useState(false);
  const { t } = useTranslation('core');

  if (content.length === 0) {
    return null;
  }

  if (showMore || plainTextLength(content) <= LIMIT) {
    return <RichText content={content} hashtagLinks={hashtagLinks} />;
  }

  const text = plainText(content);
  const preview: React.ReactNode[] = [];
  let offset = 0;
  if (hashtagLinks?.size) {
    for (const { label, href, start, end } of findHashtagLinks(
      text,
      hashtagLinks,
      LIMIT,
    )) {
      preview.push(
        text.slice(offset, start),
        <a key={start} href={href}>
          {label}
        </a>,
      );
      offset = end;
    }
  }
  preview.push(`${text.slice(offset, LIMIT)} …`);

  return (
    <div className="panel-more-wrap">
      <div className="panel-more-wrap" id={id}>
        {preview}
      </div>
      <button
        aria-controls={id}
        aria-expanded="false"
        className="panel-more-fade"
        onClick={() => setShowMore(true)}
        type="button"
      >
        {t('Read more…')}
      </button>
    </div>
  );
}
