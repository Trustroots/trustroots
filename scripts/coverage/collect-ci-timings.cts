interface WorkflowRun {
  id: number;
  run_attempt: number;
  html_url: string;
  run_started_at: string;
  status: string;
  updated_at: string;
}

interface WorkflowStep {
  number: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface WorkflowJob {
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  html_url: string;
  steps: WorkflowStep[];
}

interface WorkflowSummary {
  name: string;
  url: string;
  startedAt: string;
  completedAt: string | null;
  jobs: WorkflowJob[];
}

interface PullRequest {
  number: number;
  head: { sha: string };
}

interface WorkflowRunSummary extends WorkflowRun {
  pull_requests: PullRequest[];
}

interface WorkflowContext {
  repo: { owner: string; repo: string };
  runId: number;
  payload: { pull_request?: PullRequest | null };
}

interface GithubClient {
  rest: {
    actions: {
      getWorkflowRun(parameters: {
        owner: string;
        repo: string;
        run_id: number;
      }): Promise<{ data: WorkflowRun }>;
      listJobsForWorkflowRunAttempt(parameters: {
        owner: string;
        repo: string;
        run_id: number;
        attempt_number: number;
        per_page: number;
      }): Promise<unknown>;
      listWorkflowRuns(parameters: {
        owner: string;
        repo: string;
        workflow_id: string;
        event: string;
        head_sha: string;
        per_page: number;
      }): Promise<unknown>;
    };
  };
  paginate<T>(method: unknown, parameters: object): Promise<T[]>;
}

interface TimingsResult {
  collectedAt: string;
  workflows: WorkflowSummary[];
  unavailable: string[];
}

async function collectTimings(
  github: GithubClient,
  context: WorkflowContext,
  attempt: number,
): Promise<TimingsResult> {
  const { owner, repo } = context.repo;
  const workflows: WorkflowSummary[] = [];
  const unavailable: string[] = [];
  async function collect(run: WorkflowRun, name: string): Promise<void> {
    try {
      const jobs = await github.paginate<WorkflowJob>(
        github.rest.actions.listJobsForWorkflowRunAttempt,
        {
          owner,
          repo,
          run_id: run.id,
          attempt_number: run.run_attempt,
          per_page: 100,
        },
      );
      workflows.push({
        name,
        url: run.html_url,
        startedAt: run.run_started_at,
        completedAt: run.status === 'completed' ? run.updated_at : null,
        jobs,
      });
    } catch {
      unavailable.push(name);
    }
  }
  try {
    const { data: run } = await github.rest.actions.getWorkflowRun({
      owner,
      repo,
      run_id: context.runId,
    });
    await collect({ ...run, run_attempt: attempt }, 'Tests');
  } catch {
    unavailable.push('Tests');
  }
  const pr = context.payload.pull_request;
  if (pr) {
    try {
      const runs = await github.paginate<WorkflowRunSummary>(
        github.rest.actions.listWorkflowRuns,
        {
          owner,
          repo,
          workflow_id: 'lint.yml',
          event: 'pull_request',
          head_sha: pr.head.sha,
          per_page: 100,
        },
      );
      const run = runs
        .filter(run =>
          run.pull_requests.some(item => item.number === pr.number),
        )
        .sort((a, b) => b.id - a.id)[0];
      if (run) await collect(run, 'Linter');
      else unavailable.push('Linter');
    } catch {
      unavailable.push('Linter');
    }
  }
  return { collectedAt: new Date().toISOString(), workflows, unavailable };
}

module.exports = { collectTimings };
