const fs = require('fs');
const path = require('path');

function readTimings(root) {
  const file = path.join(root, 'coverage/ci-timings.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function duration(start, end) {
  const elapsed = Date.parse(end) - Date.parse(start);
  return Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null;
}

function formatDuration(ms) {
  if (ms === null) return 'n/a';
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}

function renderTimings(timings) {
  if (!timings || !timings.workflows.length) {
    return '<h3>CI timings</h3><p>CI timings unavailable.</p>';
  }
  const sections = timings.workflows.map(workflow => {
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
      .filter(step => step.ms !== null)
      .sort((a, b) => b.ms - a.ms)[0];
    const rows = workflow.jobs.map(job => {
      const steps = job.steps.map(step => {
        const time =
          step.status === 'completed' && step.conclusion !== 'skipped'
            ? duration(step.started_at, step.completed_at)
            : null;
        const highlight = slowest && slowest.step === step ? ' (slowest)' : '';
        return `<tr><td><a href="${escapeHtml(job.html_url)}#step:${step.number}:1">${escapeHtml(step.name)}</a>${highlight}</td><td>${escapeHtml(step.conclusion || step.status)}</td><td>${formatDuration(time)}</td></tr>`;
      });
      const time =
        job.status === 'completed'
          ? duration(job.started_at, job.completed_at)
          : null;
      return `<details><summary>${escapeHtml(job.name)} — ${escapeHtml(job.conclusion || job.status)} — ${formatDuration(time)}</summary><table><thead><tr><th>Step</th><th>Status</th><th>Duration</th></tr></thead><tbody>${steps.join('')}</tbody></table></details>`;
    });
    const elapsedLabel = workflow.completedAt
      ? 'Elapsed'
      : 'Elapsed to snapshot';
    const slowestSummary = slowest
      ? `<p>Slowest completed step: <a href="${escapeHtml(slowest.job.html_url)}#step:${slowest.step.number}:1">${escapeHtml(slowest.job.name)} / ${escapeHtml(slowest.step.name)}</a> (${formatDuration(slowest.ms)}).</p>`
      : '';
    return `<h4><a href="${escapeHtml(workflow.url)}">${escapeHtml(workflow.name)}</a></h4><p>${elapsedLabel}: ${formatDuration(duration(workflow.startedAt, workflow.completedAt || timings.collectedAt))}. Accumulated completed job time: ${formatDuration(jobTime)}. ${completedJobs.length}/${workflow.jobs.length} jobs completed.</p>${slowestSummary}${rows.join('\n')}`;
  });
  const unavailable = (timings.unavailable || []).map(
    name => `<p>${escapeHtml(name)} timings unavailable.</p>`,
  );
  return `<h3>CI timings</h3><p>Snapshot at ${escapeHtml(timings.collectedAt)}. Jobs run in parallel; accumulated job time is not elapsed time. Running and skipped steps have no completed duration. The reporting job is still running at collection time.</p>${sections.join('\n')}${unavailable.join('\n')}`;
}

module.exports = { duration, formatDuration, readTimings, renderTimings };
