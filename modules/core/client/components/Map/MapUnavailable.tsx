import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@trustroots/ui/cn';

export default function MapUnavailable({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const { t } = useTranslation('core');
  return (
    <div
      role="status"
      className={cn(
        'tw:flex tw:h-full tw:items-center tw:justify-center tw:bg-gray-100 tw:p-4 tw:text-center tw:text-muted',
        className,
      )}
      style={style}
    >
      {t('This browser cannot show the map because WebGL is not available.')}
    </div>
  );
}
