import type { OfferStatus } from '@/modules/offers/shared/offer';

export function hostStatusLabel(
  status: OfferStatus,
  t: (key: string) => string,
): string {
  const labels: Record<OfferStatus, string> = {
    yes: t('Can host'),
    maybe: t('Might be able to host'),
    no: t('Cannot host currently'),
  };
  return labels[status];
}
