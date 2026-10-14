async function collectTimings(github, context, attempt) {
  const { owner, repo } = context.repo;
  const workflows = [];
  const unavailable = [];
  async function collect(run, name) {
    try {
      const jobs = await github.paginate(
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
      const runs = await github.paginate(github.rest.actions.listWorkflowRuns, {
        owner,
        repo,
        workflow_id: 'lint.yml',
        event: 'pull_request',
        head_sha: pr.head.sha,
        per_page: 100,
      });
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
