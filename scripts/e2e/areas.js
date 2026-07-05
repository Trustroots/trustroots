const path = require('path');

const AREA_BY_SPEC = {
  'auth-smoke.spec.js': 'Authentication',
  'account-lifecycle.spec.js': 'Authentication',
  'account-email-tokens.spec.js': 'Authentication',
  'account-settings.spec.js': 'Authentication',
  'authenticated.spec.js': 'Member flows',
  'member.spec.js': 'Member flows',
  'contacts-and-blocks.spec.js': 'Member flows',
  'offers-and-circles.spec.js': 'Member flows',
  'search-map-rendered.spec.js': 'Member flows',
  'public-pages.spec.js': 'Public pages',
  'core-gaps.spec.js': 'Public pages',
  'nostr.spec.js': 'Nostr',
  'seeded-content.spec.js': 'Seeded content',
  'messages-api.spec.js': 'Messages',
  'messages.spec.js': 'Messages',
  'message-actions.spec.js': 'Messages',
  'experiences.spec.js': 'Experiences',
  'experience-actions.spec.js': 'Experiences',
  'admin.spec.js': 'Admin',
  'admin-actions.spec.js': 'Admin',
  'admin-acquisition.spec.js': 'Admin',
  'admin-inspection.spec.js': 'Admin',
  'admin-newsletter-api.spec.js': 'Admin',
  'admin-notes.spec.js': 'Admin',
  'admin-pages.spec.js': 'Admin',
  'admin-reference-errors.spec.js': 'Admin',
  'admin-role-audit.spec.js': 'Admin',
  'admin-search.spec.js': 'Admin',
  'auth.setup.js': 'Setup',
};

const DEFINED_AREAS = Array.from(
  new Set(Object.values(AREA_BY_SPEC).filter(area => area !== 'Setup')),
).sort();

function areaForSpec(specFile) {
  if (!specFile) {
    return 'Other';
  }

  const fileName = path.basename(specFile);
  return AREA_BY_SPEC[fileName] || 'Other';
}

function computeAreaCoverage(byArea = {}) {
  const exercisedAreas = DEFINED_AREAS.filter(
    area => byArea[area] && byArea[area].total > 0,
  );
  const greenAreas = DEFINED_AREAS.filter(area => {
    const results = byArea[area];
    return (
      results && results.total > 0 && results.failed === 0 && results.passed > 0
    );
  });
  const defined = DEFINED_AREAS.length;

  return {
    defined,
    exercised: exercisedAreas.length,
    green: greenAreas.length,
    areaCoverage:
      defined > 0
        ? Number(((exercisedAreas.length / defined) * 100).toFixed(2))
        : 0,
    areaPassCoverage:
      defined > 0 ? Number(((greenAreas.length / defined) * 100).toFixed(2)) : 0,
  };
}

module.exports = {
  AREA_BY_SPEC,
  DEFINED_AREAS,
  areaForSpec,
  computeAreaCoverage,
};
