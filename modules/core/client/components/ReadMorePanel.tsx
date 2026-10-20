// External dependencies
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';

// Internal dependencies
import '@/config/client/i18n';
import { plainText, plainTextLength } from '../utils/filters';
import RichText from './RichText';

const LIMIT = 2000;

type ReadMorePanelProps = { content: string; id: string };

export default function ReadMorePanel({ content, id }: ReadMorePanelProps) {
  const [showMore, setShowMore] = useState(false);
  const { t } = useTranslation('core');

  if (content.length === 0) {
    return null;
  }

  if (showMore || plainTextLength(content) <= LIMIT) {
    return <RichText content={content} />;
  }

  return (
    <div className="panel-more-wrap">
      <div className="panel-more-wrap" id={id}>
        {`${plainText(content).substr(0, LIMIT)} …`}
      </div>
      <button
        aria-controls={id}
        aria-expanded="false"
        className="panel-more-fade"
        onClick={() => setShowMore(true)}
        type="button"
      >
        {t<string>('Read more…')}
      </button>
    </div>
  );
}
