const { execFileSync } = require('child_process');
const {
  collectLineChanges,
  updateLineChangesComment,
} = require('./line-changes');
const { marker } = require('./generate-pr-summary');

function fetchCommits(number, baseSha, cwd) {
  execFileSync(
    'git',
    ['fetch', '--no-tags', 'origin', `refs/pull/${number}/head`, baseSha],
    { cwd },
  );
}

async function backfill({
  github,
  owner,
  repo,
  before,
  only,
  cwd,
  fetch = fetchCommits,
  collect = collectLineChanges,
}) {
  if (!Number.isSafeInteger(before) || before < 1) {
    throw new Error('The PR upper bound must be a positive integer');
  }
  if (
    only !== undefined &&
    (!Number.isSafeInteger(only) || only < 1 || only >= before)
  ) {
    throw new Error(
      'The selected PR must be a positive integer below the upper bound',
    );
  }
  const pulls =
    only !== undefined
      ? [{ number: only }]
      : await github.paginate(github.rest.pulls.list, {
          owner,
          repo,
          state: 'open',
          per_page: 100,
        });
  const updated = [];
  for (const pull of pulls.filter(item => item.number < before)) {
    const { data: current } = await github.rest.pulls.get({
      owner,
      repo,
      pull_number: pull.number,
    });
    if (current.state !== 'open') continue;
    fetch(current.number, current.base.sha, cwd);
    const summary = collect(current.base.sha, current.head.sha, cwd);
    const comments = await github.paginate(github.rest.issues.listComments, {
      owner,
      repo,
      issue_number: current.number,
      per_page: 100,
    });
    const existing = comments.find(
      comment => comment.user.type === 'Bot' && comment.body.includes(marker),
    );
    const body = updateLineChangesComment(
      existing ? existing.body : `${marker}\n## Pull request overview\n`,
      summary,
    );
    const { data: latest } = await github.rest.pulls.get({
      owner,
      repo,
      pull_number: current.number,
    });
    if (latest.state !== 'open' || latest.head.sha !== current.head.sha)
      continue;
    if (existing) {
      await github.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existing.id,
        body,
      });
    } else {
      await github.rest.issues.createComment({
        owner,
        repo,
        issue_number: current.number,
        body,
      });
    }
    updated.push(current.number);
  }
  return updated;
}

module.exports = { backfill, fetchCommits };
