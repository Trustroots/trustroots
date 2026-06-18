const path = require('path');

const manifest = require('../../tests/e2e/feature-coverage');

const root = path.resolve(__dirname, '../..');
const FEATURE_ANNOTATION_TYPE = 'feature';
const FEATURE_SCENARIO_SEPARATOR = '::';
const TERMINAL_FAILURES = new Set([
  'failed',
  'timedOut',
  'interrupted',
  'unexpected',
]);

function normalizePath(filePath) {
  const value = String(filePath || '');
  const normalized = path.isAbsolute(value) ? path.relative(root, value) : value;
  const unixPath = normalized.replace(/\\/g, '/');

  return unixPath.startsWith('tests/e2e/')
    ? unixPath
    : `tests/e2e/${unixPath}`;
}

function makeScenarioKey(featureId, scenario) {
  return `${featureId}${FEATURE_SCENARIO_SEPARATOR}${scenario}`;
}

function parseFeatureAnnotation(annotation) {
  if (!annotation || annotation.type !== FEATURE_ANNOTATION_TYPE) {
    return null;
  }

  const description = String(annotation.description || '').trim();
  if (!description) {
    return null;
  }

  const separatorIndex = description.indexOf(FEATURE_SCENARIO_SEPARATOR);
  if (separatorIndex === -1) {
    return {
      featureId: description,
      scenario: null,
    };
  }

  return {
    featureId: description.slice(0, separatorIndex).trim(),
    scenario: description
      .slice(separatorIndex + FEATURE_SCENARIO_SEPARATOR.length)
      .trim(),
  };
}

function isPassingStatus(status) {
  return status === 'passed' || status === 'expected';
}

function isFailingStatus(status) {
  return TERMINAL_FAILURES.has(status);
}

function getLastStatus(testCase) {
  const results = testCase.results || [];
  const lastResult = results[results.length - 1];
  return lastResult ? lastResult.status : 'skipped';
}

function collectAnnotations(spec, testCase) {
  return [
    ...(spec.annotations || []),
    ...(testCase.annotations || []),
    ...((testCase.results || []).flatMap(result => result.annotations || [])),
  ];
}

function validateFeatureManifest(featureManifest = manifest) {
  const errors = [];
  const statuses = new Set(Object.values(featureManifest.statuses || {}));
  const areas = new Set(Object.values(featureManifest.areas || {}));
  const roles = new Set(Object.keys(featureManifest.roleDefinitions || {}));
  const featureIds = new Set();

  if (!Array.isArray(featureManifest.features)) {
    return ['Feature manifest must export a features array.'];
  }

  for (const feature of featureManifest.features) {
    if (!feature || typeof feature !== 'object') {
      errors.push('Feature entries must be objects.');
      continue;
    }

    if (!feature.id) {
      errors.push('Feature entry is missing an id.');
    } else if (featureIds.has(feature.id)) {
      errors.push(`Feature id "${feature.id}" is duplicated.`);
    } else {
      featureIds.add(feature.id);
    }

    if (!statuses.has(feature.status)) {
      errors.push(`Feature "${feature.id}" has invalid status "${feature.status}".`);
    }

    if (!areas.has(feature.area)) {
      errors.push(`Feature "${feature.id}" has invalid area "${feature.area}".`);
    }

    for (const role of feature.roles || []) {
      if (!roles.has(role)) {
        errors.push(`Feature "${feature.id}" has unknown role "${role}".`);
      }
    }

    if (feature.status === featureManifest.statuses.active) {
      if (
        !Array.isArray(feature.requiredScenarios) ||
        feature.requiredScenarios.length === 0
      ) {
        errors.push(`Active feature "${feature.id}" has no required scenarios.`);
      }
    }

    if (
      feature.status === featureManifest.statuses.excluded &&
      !feature.exclusionReason
    ) {
      errors.push(`Excluded feature "${feature.id}" has no exclusionReason.`);
    }

    if (!Array.isArray(feature.relatedSpecs)) {
      errors.push(`Feature "${feature.id}" relatedSpecs must be an array.`);
    } else {
      for (const spec of feature.relatedSpecs) {
        if (!spec || !spec.file || !spec.title) {
          errors.push(
            `Feature "${feature.id}" has a relatedSpec without file/title.`,
          );
        }
      }
    }
  }

  return errors;
}

function buildRelatedSpecIndex(features) {
  const index = new Map();

  for (const feature of features) {
    for (const relatedSpec of feature.relatedSpecs || []) {
      const key = `${normalizePath(relatedSpec.file)}::${relatedSpec.title}`;
      if (!index.has(key)) {
        index.set(key, []);
      }
      index.get(key).push(feature.id);
    }
  }

  return index;
}

function collectFeatureEvidence(report, features) {
  const annotated = new Map();
  const relatedPassingSpecs = new Map();
  const relatedSpecIndex = buildRelatedSpecIndex(features);

  function recordAnnotated(featureId, update) {
    if (!annotated.has(featureId)) {
      annotated.set(featureId, {
        touched: false,
        passedScenarios: new Set(),
        failedScenarios: new Set(),
        failed: false,
      });
    }

    const evidence = annotated.get(featureId);
    update(evidence);
  }

  function walkSuites(suiteList) {
    for (const suite of suiteList || []) {
      for (const spec of suite.specs || []) {
        const specFile = normalizePath(spec.file || '');

        for (const testCase of spec.tests || []) {
          const status = getLastStatus(testCase);
          const passed = isPassingStatus(status);
          const failed = isFailingStatus(status);
          const relatedKey = `${specFile}::${spec.title}`;

          if (passed && relatedSpecIndex.has(relatedKey)) {
            for (const featureId of relatedSpecIndex.get(relatedKey)) {
              if (!relatedPassingSpecs.has(featureId)) {
                relatedPassingSpecs.set(featureId, []);
              }
              relatedPassingSpecs.get(featureId).push({
                file: specFile,
                title: spec.title,
              });
            }
          }

          for (const annotation of collectAnnotations(spec, testCase)) {
            const parsed = parseFeatureAnnotation(annotation);
            if (!parsed) {
              continue;
            }

            recordAnnotated(parsed.featureId, evidence => {
              evidence.touched = true;
              if (failed) {
                evidence.failed = true;
                if (parsed.scenario) {
                  evidence.failedScenarios.add(parsed.scenario);
                }
              }
              if (passed && parsed.scenario) {
                evidence.passedScenarios.add(parsed.scenario);
              }
            });
          }
        }
      }

      walkSuites(suite.suites);
    }
  }

  walkSuites(report.suites);

  return {
    annotated,
    relatedPassingSpecs,
  };
}

function summarizeFeatureCoverage(report, featureManifest = manifest) {
  const validationErrors = validateFeatureManifest(featureManifest);
  const activeFeatures = featureManifest.features.filter(
    feature => feature.status === featureManifest.statuses.active,
  );
  const excludedFeatures = featureManifest.features.filter(
    feature => feature.status === featureManifest.statuses.excluded,
  );
  const evidence = collectFeatureEvidence(report, featureManifest.features);
  const features = [];
  const missingByArea = {};

  let coveredFeatureCount = 0;
  let greenFeatureCount = 0;
  let touchedFeatureCount = 0;
  let coveredScenarioCount = 0;
  let requiredScenarioCount = 0;

  for (const feature of activeFeatures) {
    const annotations = evidence.annotated.get(feature.id);
    const relatedSpecs = evidence.relatedPassingSpecs.get(feature.id) || [];
    const passedScenarios = annotations ? annotations.passedScenarios : new Set();
    const coveredByLegacyRelatedSpecs = relatedSpecs.length > 0;
    const missingScenarios = [];

    for (const scenario of feature.requiredScenarios || []) {
      requiredScenarioCount += 1;
      if (passedScenarios.has(scenario) || coveredByLegacyRelatedSpecs) {
        coveredScenarioCount += 1;
      } else {
        missingScenarios.push(scenario);
      }
    }

    const touched = Boolean(
      (annotations && annotations.touched) || relatedSpecs.length > 0,
    );
    const covered = missingScenarios.length === 0;
    const green = covered && !(annotations && annotations.failed);

    if (touched) {
      touchedFeatureCount += 1;
    }
    if (covered) {
      coveredFeatureCount += 1;
    }
    if (green) {
      greenFeatureCount += 1;
    }

    if (!covered) {
      if (!missingByArea[feature.area]) {
        missingByArea[feature.area] = [];
      }
      missingByArea[feature.area].push({
        id: feature.id,
        missingScenarios,
        relatedPassingSpecs: relatedSpecs,
      });
    }

    features.push({
      id: feature.id,
      area: feature.area,
      requiredScenarioCount: (feature.requiredScenarios || []).length,
      coveredScenarioCount:
        (feature.requiredScenarios || []).length - missingScenarios.length,
      missingScenarios,
      touched,
      covered,
      green,
      relatedPassingSpecs: relatedSpecs,
    });
  }

  const activeFeatureCount = activeFeatures.length;

  return {
    validationErrors,
    activeFeatureCount,
    excludedFeatureCount: excludedFeatures.length,
    touchedFeatureCount,
    coveredFeatureCount,
    missingFeatureCount: activeFeatureCount - coveredFeatureCount,
    greenFeatureCount,
    requiredScenarioCount,
    coveredScenarioCount,
    missingScenarioCount: requiredScenarioCount - coveredScenarioCount,
    featureCoverage:
      activeFeatureCount > 0
        ? Number(((coveredFeatureCount / activeFeatureCount) * 100).toFixed(2))
        : 0,
    featurePassCoverage:
      activeFeatureCount > 0
        ? Number(((greenFeatureCount / activeFeatureCount) * 100).toFixed(2))
        : 0,
    scenarioCoverage:
      requiredScenarioCount > 0
        ? Number(((coveredScenarioCount / requiredScenarioCount) * 100).toFixed(2))
        : 0,
    missingByArea,
    features,
    excludedFeatures: excludedFeatures.map(feature => ({
      id: feature.id,
      area: feature.area,
      exclusionReason: feature.exclusionReason,
    })),
  };
}

function featureAnnotation(featureId, scenario) {
  return {
    type: FEATURE_ANNOTATION_TYPE,
    description: scenario
      ? `${featureId}${FEATURE_SCENARIO_SEPARATOR}${scenario}`
      : featureId,
  };
}

function annotateFeature(testInfo, featureId, scenarios = []) {
  const scenarioList = Array.isArray(scenarios) ? scenarios : [scenarios];

  if (scenarioList.length === 0) {
    testInfo.annotations.push(featureAnnotation(featureId));
    return;
  }

  for (const scenario of scenarioList) {
    testInfo.annotations.push(featureAnnotation(featureId, scenario));
  }
}

module.exports = {
  FEATURE_ANNOTATION_TYPE,
  FEATURE_SCENARIO_SEPARATOR,
  annotateFeature,
  featureAnnotation,
  makeScenarioKey,
  parseFeatureAnnotation,
  summarizeFeatureCoverage,
  validateFeatureManifest,
};
