const { execFile } = require('child_process');
const path = require('path');

const GITHUB_COMMIT_URL = 'https://github.com/Trustroots/trustroots/commit/';

function normalizeBranch(branch) {
  const normalizedBranch = String(branch || '')
    .trim()
    .replace(/^refs\/heads\//, '');

  if (!normalizedBranch || normalizedBranch === 'HEAD') {
    return false;
  }

  return normalizedBranch;
}

function getEnvironmentBranch() {
  return normalizeBranch(
    process.env.TRUSTROOTS_BUILD_BRANCH ||
      process.env.GITHUB_HEAD_REF ||
      process.env.GITHUB_REF_NAME,
  );
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatUtcDateTime(date) {
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

function buildMetadataFromGitLog(output, branch) {
  const [commit, committedAtIso, outputBranch] = String(output || '')
    .trim()
    .split('\n');
  const normalizedBranch = normalizeBranch(branch || outputBranch);

  if (!commit || !committedAtIso) {
    return false;
  }

  const committedAt = new Date(committedAtIso);

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

function getBuildMetadata(callback) {
  execFile(
    'git',
    ['log', '-1', '--pretty=format:%H%n%cI'],
    { cwd: path.resolve(__dirname, '../..') },
    function (error, stdout) {
      if (error) {
        callback(false);
        return;
      }

      const environmentBranch = getEnvironmentBranch();

      if (environmentBranch) {
        callback(buildMetadataFromGitLog(stdout, environmentBranch));
        return;
      }

      execFile(
        'git',
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        { cwd: path.resolve(__dirname, '../..') },
        function (branchError, branchStdout) {
          callback(
            buildMetadataFromGitLog(stdout, branchError ? false : branchStdout),
          );
        },
      );
    },
  );
}

exports.buildMetadataFromGitLog = buildMetadataFromGitLog;
exports.formatUtcDateTime = formatUtcDateTime;
exports.getBuildMetadata = getBuildMetadata;
