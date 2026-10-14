const { execFileSync } = require('node:child_process') as typeof import('node:child_process');
const lineChanges = require('./line-changes.cts') as {
  collectLineChanges: (baseSha: string, headSha: string, cwd: string) => LineChangesSummary;
  updateLineChangesComment: (body: string, summary: LineChangesSummary) => string;
};
const { collectLineChanges, updateLineChangesComment } = lineChanges;
const { marker } = require('./generate-pr-summary.cts') as { marker: string };

interface LineChangesSummary {
  groups: Array<{ id: string; label: string; added: number; removed: number; net: number }>;
  binaryFiles: number;
  dependencies?: Array<{
    label: string;
    added: number;
    removed: number;
    changed: number;
    net: number;
    changes: Array<{ name: string; before: string | undefined; after: string | undefined }>;
  }>;
}

interface PullRequest {
  number: number;
  state: string;
  base: { sha: string };
  head: { sha: string };
}

interface PullRequestComment {
  id: number;
  user: { type: string };
  body: string;
}

interface GithubClient {
  rest: {
    pulls: {
      list: unknown;
      get(parameters: {
        owner: string;
        repo: string;
        pull_number: number;
      }): Promise<{ data: PullRequest }>;
    };
    issues: {
      listComments: unknown;
      updateComment(parameters: {
        owner: string;
        repo: string;
        comment_id: number;
        body: string;
      }): Promise<unknown>;
      createComment(parameters: {
        owner: string;
        repo: string;
        issue_number: number;
        body: string;
      }): Promise<unknown>;
    };
  };
  paginate<T>(method: unknown, parameters: object): Promise<T[]>;
}

interface BackfillOptions {
  github: GithubClient;
  owner: string;
  repo: string;
  before: number;
  only?: number;
  cwd: string;
  fetch?: typeof fetchCommits;
  collect?: typeof collectLineChanges;
}

function fetchCommits(number: number, baseSha: string, cwd: string): void {
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
}: BackfillOptions): Promise<number[]> {
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
      : await github.paginate<{ number: number }>(github.rest.pulls.list, {
          owner,
          repo,
          state: 'open',
          per_page: 100,
        });
  const updated: number[] = [];
  for (const pull of pulls.filter(item => item.number < before)) {
    const { data: current } = await github.rest.pulls.get({
      owner,
      repo,
      pull_number: pull.number,
    });
    if (current.state !== 'open') continue;
    fetch(current.number, current.base.sha, cwd);
    const summary = collect(current.base.sha, current.head.sha, cwd);
    const comments = await github.paginate<PullRequestComment>(
      github.rest.issues.listComments,
      {
      owner,
      repo,
      issue_number: current.number,
      per_page: 100,
      },
    );
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
