import { newsletterAudienceFilename } from '@/modules/admin/client/utils/newsletter-audience-filename';

describe('newsletter audience filenames', () => {
  const criteria = {
    circleIds: [],
    latitude: '12.34',
    locationText: 'Exampleville',
    longitude: '-56.78',
    radiusKm: '50',
    sources: ['from', 'hosting', 'living'],
  };
  const exportedAt = new Date(2026, 0, 2, 3, 4);
  const filename = (update, circles = []) =>
    newsletterAudienceFilename({ ...criteria, ...update }, circles, exportedAt);

  it('includes the location, hosting radius and padded local datetime', () => {
    expect(filename({})).toBe(
      'newsletter-audience-Exampleville-50km-20260102-0304.csv',
    );
  });

  it('describes narrowed text sources without an unused hosting radius', () => {
    expect(filename({ sources: ['from', 'living'] })).toBe(
      'newsletter-audience-Exampleville-living-origin-20260102-0304.csv',
    );
    expect(filename({ sources: ['living'] })).toBe(
      'newsletter-audience-Exampleville-living-20260102-0304.csv',
    );
    expect(filename({ sources: ['from'] })).toBe(
      'newsletter-audience-Exampleville-origin-20260102-0304.csv',
    );
  });

  it('uses coordinates for hosting-only audiences', () => {
    expect(filename({ sources: ['hosting'], radiusKm: '12.5' })).toBe(
      'newsletter-audience-lat12.34-lon-56.78-12.5km-hosting-20260102-0304.csv',
    );
  });

  it('uses selected circle names and falls back to unknown circle IDs', () => {
    expect(
      filename(
        { sources: [], circleIds: ['circle-b', 'circle-a', 'circle-unknown'] },
        [
          { _id: 'circle-a', label: 'Example walkers' },
          { _id: 'circle-b', label: 'Example cyclists' },
        ],
      ),
    ).toBe(
      'newsletter-audience-circles-Example-cyclists-Example-walkers-circle-unknown-20260102-0304.csv',
    );
  });

  it('combines location and circle filters and sanitises unsafe characters', () => {
    expect(
      filename(
        { locationText: '  Example / town: north?  ', circleIds: ['circle-a'] },
        [{ _id: 'circle-a', label: 'Example & friends' }],
      ),
    ).toBe(
      'newsletter-audience-Example-town-north-50km-circles-Example-friends-20260102-0304.csv',
    );
    expect(filename({ locationText: '/?*' })).toBe(
      'newsletter-audience-filter-50km-20260102-0304.csv',
    );
  });

  it('retains readable Unicode names', () => {
    expect(filename({ locationText: 'Éxample 城' })).toBe(
      'newsletter-audience-Éxample-城-50km-20260102-0304.csv',
    );
  });
});
