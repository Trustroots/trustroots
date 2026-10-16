const fs = require('fs') as typeof import('node:fs');
const path = require('path') as typeof import('node:path');

interface WorkflowStep {
  number: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

interface WorkflowJob {
  name: string;
  status: string;
  conclusion?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  html_url: string;
  steps: WorkflowStep[];
}

interface WorkflowTiming {
  name: string;
  url: string;
  startedAt: string | null;
  completedAt: string | null;
  jobs: WorkflowJob[];
}

interface CiTimings {
  collectedAt: string;
  workflows: WorkflowTiming[];
  unavailable?: string[];
}

function readTimings(root: string): CiTimings | null {
  const file = path.join(root, 'coverage/ci-timings.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as CiTimings;
  } catch {
    return null;
  }
}

function escapeHtml(value: string | null | undefined): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function duration(
  start: string | null | undefined,
  end: string | null | undefined,
): number | null {
  if (!start || !end) return null;
  const elapsed = Date.parse(end) - Date.parse(start);
  return Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return 'n/a';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}

function pace(
  ms: number | null,
  status: string,
  conclusion?: string | null,
): string {
  if (conclusion === 'skipped') return '⚪ Skipped';
  if (status !== 'completed') return '⚪ Pending';
  if (ms === null) return '⚪ Unavailable';
  if (ms < 60_000) return '🟢 Fast';
  if (ms < 300_000) return '🟡 Moderate';
  return '🔴 Slow';
}

function renderTimings(
  timings: CiTimings | null | undefined,
  compact = false,
): string {
  if (!timings || !timings.workflows.length) {
    return '<h3>CI timings</h3><p>CI timings unavailable.</p>';
  }
  const sections = timings.workflows.map(workflow => {
    const statusLabel = (value: string): string =>
      compact
        ? (
            {
              success: '✅ Passed',
              failure: 'Failed',
              skipped: 'Skipped',
              in_progress: 'Running',
              queued: 'Queued',
              cancelled: 'Cancelled',
              timed_out: 'Timed out',
              neutral: 'Neutral',
              action_required: 'Action required',
            } as Record<string, string>
          )[value] || value
        : value;
    const completedJobs = workflow.jobs.filter(
      job => job.status === 'completed',
    );
    const jobTime = completedJobs.reduce(
      (sum, job) => sum + (duration(job.started_at, job.completed_at) || 0),
      0,
    );
    const completedSteps = workflow.jobs.flatMap(job =>
      job.steps
        .filter(
          step => step.status === 'completed' && step.conclusion !== 'skipped',
        )
        .map(step => ({
          job,
          step,
          ms: duration(step.started_at, step.completed_at),
        })),
    );
    const slowest = completedSteps
      .filter((step): step is typeof step & { ms: number } => step.ms !== null)
      .sort((a, b) => b.ms - a.ms)[0];
    const overview: string[] = [];
    const slowJobs: string[] = [];
    const slowSteps: string[] = [];
    const rows = workflow.jobs.map(job => {
      const steps = job.steps.map(step => {
        const time =
          step.status === 'completed' && step.conclusion !== 'skipped'
            ? duration(step.started_at, step.completed_at)
            : null;
        const highlight = slowest && slowest.step === step ? ' (slowest)' : '';
        const cells = `<td><a href="${escapeHtml(job.html_url)}#step:${step.number}:1">${escapeHtml(step.name)}</a>${highlight}</td><td>${escapeHtml(statusLabel(step.conclusion || step.status))}</td><td>${formatDuration(time)}</td><td>${pace(time, step.status, step.conclusion)}</td>`;
        if (time !== null && time >= 300_000) {
          slowSteps.push(`<tr><td>${escapeHtml(job.name)}</td>${cells}</tr>`);
        }
        return `<tr>${cells}</tr>`;
      });
      const time =
        job.status === 'completed' && job.conclusion !== 'skipped'
          ? duration(job.started_at, job.completed_at)
          : null;
      const speed = pace(time, job.status, job.conclusion);
      const jobRow = `<tr><td>${speed}</td><td><a href="${escapeHtml(job.html_url)}">${escapeHtml(job.name)}</a></td><td>${escapeHtml(statusLabel(job.conclusion || job.status))}</td><td><strong>${formatDuration(time)}</strong></td></tr>`;
      overview.push(jobRow);
      if (time !== null && time >= 300_000) slowJobs.push(jobRow);
      return `<details><summary>${speed} · ${escapeHtml(job.name)} — ${escapeHtml(statusLabel(job.conclusion || job.status))} — ${formatDuration(time)}</summary><table><thead><tr><th>Step</th><th>Status</th><th>Duration</th><th>Pace</th></tr></thead><tbody>${steps.join('')}</tbody></table></details>`;
    });
    const elapsedLabel = workflow.completedAt
      ? 'Elapsed'
      : 'Elapsed to snapshot';
    const slowestSummary = slowest
      ? `<p>Slowest completed step: <a href="${escapeHtml(slowest.job.html_url)}#step:${slowest.step.number}:1">${escapeHtml(slowest.job.name)} / ${escapeHtml(slowest.step.name)}</a> (${formatDuration(slowest.ms)}).</p>`
      : '';
    const jobTables = `<table><thead><tr><th>Pace</th><th>Job</th><th>Status</th><th>Duration</th></tr></thead><tbody>${overview.join('')}</tbody></table><details><summary>Step timings</summary>${rows.join('\n')}</details>`;
    const slowTables = compact
      ? [
          slowJobs.length
            ? `<h5>Slow jobs</h5><table><thead><tr><th>Pace</th><th>Job</th><th>Status</th><th>Duration</th></tr></thead><tbody>${slowJobs.join('')}</tbody></table>`
            : '',
          slowSteps.length
            ? `<h5>Slow steps</h5><table><thead><tr><th>Job</th><th>Step</th><th>Status</th><th>Duration</th><th>Pace</th></tr></thead><tbody>${slowSteps.join('')}</tbody></table>`
            : '',
        ].join('')
      : '';
    const failures = compact
      ? workflow.jobs
          .filter(
            job =>
              job.conclusion &&
              !['success', 'neutral'].includes(job.conclusion),
          )
          .map(
            job =>
              `<p>${escapeHtml(job.name)}: ${escapeHtml(statusLabel(job.conclusion!))}.</p>`,
          )
          .join('')
      : '';
    return `<h4><a href="${escapeHtml(workflow.url)}">${escapeHtml(workflow.name)}</a></h4><p>${elapsedLabel}: ${formatDuration(duration(workflow.startedAt, workflow.completedAt || timings.collectedAt))}. Accumulated completed job time: ${formatDuration(jobTime)}. ${completedJobs.length}/${workflow.jobs.length} jobs completed.</p>${slowestSummary}${failures}${slowTables}${compact ? `<details><summary>Job and step timings</summary>${jobTables}</details>` : jobTables}`;
  });
  const unavailable = (timings.unavailable || []).map(
    name => `<p>${escapeHtml(name)} timings unavailable.</p>`,
  );
  return `<h3>CI timings</h3><p>🟢 Fast: under 1m · 🟡 Moderate: 1–5m · 🔴 Slow: 5m or more · ⚪ Pending, skipped or unavailable.</p><p>Snapshot at ${escapeHtml(timings.collectedAt)}. Jobs run in parallel; accumulated job time is not elapsed time. Running and skipped steps have no completed duration. The reporting job is still running at collection time.</p>${sections.join('\n')}${unavailable.join('\n')}`;
}

module.exports = { duration, formatDuration, readTimings, renderTimings };
