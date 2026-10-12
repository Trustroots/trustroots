import type { NewsletterAudienceCriteria } from '../api/newsletter.api';

const LOCATION_SOURCES: NewsletterAudienceCriteria['sources'] = [
  'living',
  'from',
  'hosting',
];

function filenamePart(value: string) {
  return (
    value
      .trim()
      .replace(/[^\p{L}\p{N}.-]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'filter'
  );
}

export function newsletterAudienceFilename(
  criteria: NewsletterAudienceCriteria,
  circles: Array<{ _id: string; label: string }>,
  exportedAt = new Date(),
) {
  const parts: string[] = [];
  const usesTextLocation =
    criteria.sources.includes('living') || criteria.sources.includes('from');
  if (usesTextLocation) {
    parts.push(filenamePart(criteria.locationText));
  }
  if (criteria.sources.includes('hosting')) {
    if (!usesTextLocation) {
      parts.push(
        filenamePart(`lat${criteria.latitude}-lon${criteria.longitude}`),
      );
    }
    parts.push(`${filenamePart(criteria.radiusKm)}km`);
  }
  if (criteria.sources.length > 0 && criteria.sources.length < 3) {
    parts.push(
      LOCATION_SOURCES.filter(source => criteria.sources.includes(source))
        .map(source => (source === 'from' ? 'origin' : source))
        .join('-'),
    );
  }
  if (criteria.circleIds.length > 0) {
    parts.push(
      'circles',
      ...criteria.circleIds.map(id =>
        filenamePart(circles.find(circle => circle._id === id)?.label || id),
      ),
    );
  }
  const pad = (value: number) => String(value).padStart(2, '0');
  const timestamp = `${exportedAt.getFullYear()}${pad(
    exportedAt.getMonth() + 1,
  )}${pad(exportedAt.getDate())}-${pad(exportedAt.getHours())}${pad(
    exportedAt.getMinutes(),
  )}`;
  return `newsletter-audience-${parts.join('-')}-${timestamp}.csv`;
}
