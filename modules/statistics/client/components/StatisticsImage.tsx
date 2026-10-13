import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function StatisticsImage({
  alt,
  src,
  width,
}: {
  alt: string;
  src: string;
  width?: string;
}) {
  const [failed, setFailed] = useState(false);
  const { t } = useTranslation('statistics');

  if (failed) {
    return (
      <span role="status">
        {alt}: {String(t('Image unavailable'))}
      </span>
    );
  }

  return (
    <img
      alt={alt}
      src={src}
      width={width}
      className="img-responsive"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
