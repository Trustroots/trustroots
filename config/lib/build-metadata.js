const { execFile } = require('child_process');
const path = require('path');
const metadata = require('./build-metadata.cts');

function getBuildMetadata(callback) {
  const environmentMetadata = metadata.buildMetadataFromEnvironment();

  if (environmentMetadata) {
    callback(environmentMetadata);
    return;
  }

  execFile(
    'git',
    ['log', '-1', '--pretty=format:%H%n%cI'],
    { cwd: path.resolve(__dirname, '../..') },
    function (error, stdout) {
      if (error) {
        callback(false);
        return;
      }

      const environmentBranch = metadata.getEnvironmentBranch();

      if (environmentBranch) {
        callback(metadata.buildMetadataFromGitLog(stdout, environmentBranch));
        return;
      }

      execFile(
        'git',
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        { cwd: path.resolve(__dirname, '../..') },
        function (branchError, branchStdout) {
          callback(
            metadata.buildMetadataFromGitLog(
              stdout,
              branchError ? false : branchStdout,
            ),
          );
        },
      );
    },
  );
}

exports.buildMetadataFromGitLog = metadata.buildMetadataFromGitLog;
exports.buildMetadataFromEnvironment = metadata.buildMetadataFromEnvironment;
exports.formatUtcDateTime = metadata.formatUtcDateTime;
exports.getBuildMetadata = getBuildMetadata;
