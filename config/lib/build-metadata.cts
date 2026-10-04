type BuildMetadata = {
  commit: string;
  shortCommit: string;
  committedAt: string;
  commitUrl: string;
  branch?: string;
};

const GITHUB_COMMIT_URL = 'https://github.com/Trustroots/trustroots/commit/';

function normalizeBranch(branch: string | false | undefined): string | false {
  const normalizedBranch = String(branch || '')
    .trim()
    .replace(/^refs\/heads\//, '');

  if (!normalizedBranch || normalizedBranch === 'HEAD') {
    return false;
  }

  return normalizedBranch;
}

function getEnvironmentBranch(): string | false {
  return normalizeBranch(
    process.env.TRUSTROOTS_BUILD_BRANCH ||
      process.env.GITHUB_HEAD_REF ||
      process.env.GITHUB_REF_NAME,
  );
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatUtcDateTime(date: Date): string {
  return (
    date.getUTCFullYear() +
    '-' +
    pad(date.getUTCMonth() + 1) +
    '-' +
    pad(date.getUTCDate()) +
    ' ' +
    pad(date.getUTCHours()) +
    ':' +
    pad(date.getUTCMinutes())
  );
}

function buildMetadataFromValues(
  commit: string | undefined,
  committedAtIso: string | undefined,
  branch: string | false | undefined,
): BuildMetadata | false {
  if (!commit || !committedAtIso) {
    return false;
  }

  const committedAt = new Date(committedAtIso);
  const normalizedBranch = normalizeBranch(branch);

  if (Number.isNaN(committedAt.getTime())) {
    return false;
  }

  return {
    commit,
    shortCommit: commit.slice(0, 7),
    committedAt: formatUtcDateTime(committedAt),
    commitUrl: GITHUB_COMMIT_URL + commit,
    ...(normalizedBranch ? { branch: normalizedBranch } : {}),
  };
}

function buildMetadataFromEnvironment(): BuildMetadata | false {
  return buildMetadataFromValues(
    process.env.TRUSTROOTS_BUILD_COMMIT,
    process.env.TRUSTROOTS_BUILD_COMMITTED_AT,
    getEnvironmentBranch(),
  );
}

function buildMetadataFromGitLog(
  output: unknown,
  branch?: string | false,
): BuildMetadata | false {
  const [commit, committedAtIso, outputBranch] = String(output || '')
    .trim()
    .split('\n');

  return buildMetadataFromValues(
    commit,
    committedAtIso,
    branch || outputBranch,
  );
}

module.exports = {
  buildMetadataFromGitLog,
  buildMetadataFromEnvironment,
  formatUtcDateTime,
  getEnvironmentBranch,
};
