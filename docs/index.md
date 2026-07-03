---
title: Trustroots Team Guide
redirect_from:
  - /Volunteering
  - /Volunteering/
  - /Volunteering.html
  - /volunteering
  - /volunteering/
  - /volunteering.html
---

## Volunteer

### Nostr — decentralized social networking

Trustroots is exploring how hospitality networks can rely less on individually run servers and administrative overhead. Nostr offers a promising path toward a more decentralized, gift-economy social web. One of the most helpful actions you can take is to try it out and provide feedback, negative or positive.

Learn more at [nos.trustroots.org](https://nos.trustroots.org).

### Technical help

Trustroots was in maintenance mode from 2022 till June 2026, development work is happening again and technical help is very welcome.

Useful areas include simplifying old code, upgrading dependencies, helping with the React transition, and connecting Trustroots with Nostr/Nostroots.

Check what's been going on recently, your help is very welcome.

## Recent activity

<section class="activity-panel" data-activity-panel>
  <div id="activity-list" class="activity-list" aria-live="polite">
  </div>
</section>

<script>
  (() => {
    const repos = [
      { name: "Trustroots/trustroots", label: "Trustroots" },
      { name: "Trustroots/nostroots", label: "Nostroots" },
    ];
    const list = document.getElementById("activity-list");
    const limits = {
      commits: 3,
      issues: 3,
      pulls: 3,
    };

    const escapeHtml = value =>
      String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const activityColumns = ["Type", "Update", "Repository", "Author", "When"];
    const activityHeader = activityColumns
      .map(label => `<th scope="col">${escapeHtml(label)}</th>`)
      .join("");
    const loadingActivityMessage = "Loading recent activity.";
    const fallbackActivityMessage =
      "Open GitHub for the latest issues, pull requests, and commits.";
    const activityTypeClass = type =>
      ({ PR: "pr", Issue: "issue", Commit: "commit" })[type] || "commit";
    const renderActivityRows = items =>
      items
        .map(item => {
          const author = item.author ? `by ${item.author}` : "";
          const relative = relativeDate(item.date);

          return `
            <tr>
              <td class="activity-type">
                <span class="activity-badge activity-badge-${activityTypeClass(
                  item.type,
                )}">${escapeHtml(item.type)}</span>
              </td>
              <td class="activity-title-cell">
                <a class="activity-title-link" href="${escapeHtml(item.url)}">
                  <span class="activity-title">${escapeHtml(item.title)}</span>
                </a>
              </td>
              <td class="activity-repo">${escapeHtml(item.repo)}</td>
              <td class="activity-author">${escapeHtml(author)}</td>
              <td class="activity-time">
                <time datetime="${escapeHtml(item.date)}">${escapeHtml(relative)}</time>
              </td>
            </tr>
          `;
        })
        .join("");
    const renderActivityTable = rows => `
      <div class="activity-table-wrap">
        <table class="activity-table coverage-table" aria-label="Recent team activity">
          <thead>
            <tr>${activityHeader}</tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    const renderActivityMessage = message =>
      `<p class="activity-empty">${escapeHtml(message)}</p>`;
    const renderActivityLoading = () => {
      list.innerHTML = renderActivityMessage(loadingActivityMessage);
    };
    const renderActivityUnavailable = () => {
      list.innerHTML = renderActivityMessage(fallbackActivityMessage);
    };

    const relativeDate = value => {
      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return "";
      }

      const seconds = Math.round((date.getTime() - Date.now()) / 1000);
      const units = [
        ["year", 31536000],
        ["month", 2592000],
        ["week", 604800],
        ["day", 86400],
        ["hour", 3600],
        ["minute", 60],
      ];
      const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

      for (const [unit, unitSeconds] of units) {
        if (Math.abs(seconds) >= unitSeconds) {
          return formatter.format(Math.round(seconds / unitSeconds), unit);
        }
      }

      return "just now";
    };

    // GitHub allows only 60 unauthenticated API requests per hour per IP,
    // so cache results locally and reuse stale data when rate-limited.
    const cacheKey = "team-trustroots-activity-v1";
    const cacheTtlMs = 10 * 60 * 1000;

    const readCache = () => {
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey));

        if (
          cached &&
          typeof cached.savedAt === "number" &&
          Array.isArray(cached.items) &&
          cached.items.length > 0
        ) {
          return cached;
        }
      } catch (error) {
        // Ignore unavailable or corrupt localStorage.
      }

      return null;
    };

    const writeCache = items => {
      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({ savedAt: Date.now(), items }),
        );
      } catch (error) {
        // Ignore unavailable localStorage.
      }
    };

    const fetchJson = async url => {
      const response = await fetch(url, {
        headers: { Accept: "application/vnd.github+json" },
      });

      if (!response.ok) {
        throw new Error(`GitHub response ${response.status}`);
      }

      return response.json();
    };

    const repoActivity = async repo => {
      const [issueResult, commitResult] = await Promise.allSettled([
        fetchJson(
          `https://api.github.com/repos/${repo.name}/issues?state=open&sort=created&direction=desc&per_page=20`,
        ),
        fetchJson(`https://api.github.com/repos/${repo.name}/commits?per_page=20`),
      ]);
      const issueResponse =
        issueResult.status === "fulfilled" ? issueResult.value : [];
      const commitResponse =
        commitResult.status === "fulfilled" ? commitResult.value : [];

      const pulls = issueResponse
        .filter(item => item.pull_request)
        .slice(0, limits.pulls)
        .map(item => ({
          repo: repo.label,
          type: "PR",
          title: item.title,
          url: item.html_url,
          author: item.user && item.user.login,
          date: item.created_at,
        }));

      const issues = issueResponse
        .filter(item => !item.pull_request)
        .slice(0, limits.issues)
        .map(item => ({
          repo: repo.label,
          type: "Issue",
          title: item.title,
          url: item.html_url,
          author: item.user && item.user.login,
          date: item.created_at,
        }));

      const commits = commitResponse.slice(0, limits.commits).map(item => ({
        repo: repo.label,
        type: "Commit",
        title: (item.commit.message || "").split("\n")[0],
        url: item.html_url,
        author:
          (item.author && item.author.login) ||
          (item.commit.author && item.commit.author.name),
        date: item.commit.author && item.commit.author.date,
      }));

      return [
        ...pulls,
        ...issues,
        ...commits,
      ];
    };

    const renderActivity = items => {
      const sorted = items
        .filter(item => item.date && item.title && item.url)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      if (sorted.length === 0) {
        throw new Error("No recent activity found");
      }

      list.innerHTML = renderActivityTable(renderActivityRows(sorted));
    };

    const showUnavailable = () => {
      renderActivityUnavailable();
    };

    const loadActivity = async () => {
      const cached = readCache();

      if (cached && Date.now() - cached.savedAt < cacheTtlMs) {
        renderActivity(cached.items);
        return;
      }

      try {
        const items = (await Promise.all(repos.map(repoActivity))).flat();
        renderActivity(items);
        writeCache(items);
      } catch (error) {
        // Rate-limited or offline; stale cache beats no data.
        if (cached) {
          renderActivity(cached.items);
        } else {
          showUnavailable();
        }
      }
    };

    renderActivityLoading();
    loadActivity().catch(showUnavailable);
  })();
</script>

## Test coverage

<section class="coverage-panel" data-coverage-panel>
  <div class="coverage-panel-main">
    <div>
      <h3 id="coverage-panel-title">Coverage status</h3>
      <p id="coverage-panel-summary">Loading latest coverage status.</p>
    </div>
    <div class="coverage-panel-actions">
      <a
        class="ci-badge"
        href="https://github.com/Trustroots/trustroots/actions/workflows/test.yml"
        aria-label="GitHub Actions test workflow"
      >
        <img
          src="https://github.com/Trustroots/trustroots/actions/workflows/test.yml/badge.svg"
          alt="Tests"
          width="99"
          height="20"
        />
      </a>
      <a class="coverage-panel-link" href="/coverage/">Open report</a>
    </div>
  </div>
  <div class="coverage-table-wrap">
    <table class="coverage-table" aria-label="Coverage suite results">
      <thead>
        <tr>
          <th>Suite</th>
          <th>Status</th>
          <th>Recorded</th>
          <th>Result</th>
          <th>Report</th>
        </tr>
      </thead>
      <tbody>
        <tr data-coverage-suite="client">
          <td class="coverage-suite-name">Client</td>
          <td><span class="coverage-status coverage-status-loading">Loading</span></td>
          <td class="coverage-recorded"></td>
          <td class="coverage-result"></td>
          <td class="coverage-report"></td>
        </tr>
        <tr data-coverage-suite="server">
          <td class="coverage-suite-name">Server</td>
          <td><span class="coverage-status coverage-status-loading">Loading</span></td>
          <td class="coverage-recorded"></td>
          <td class="coverage-result"></td>
          <td class="coverage-report"></td>
        </tr>
        <tr data-coverage-suite="e2e">
          <td class="coverage-suite-name">End-to-end</td>
          <td><span class="coverage-status coverage-status-loading">Loading</span></td>
          <td class="coverage-recorded"></td>
          <td class="coverage-result"></td>
          <td class="coverage-report"></td>
        </tr>
      </tbody>
    </table>
  </div>
</section>

<script>
  (() => {
    const suites = [
      { name: "client", label: "Client" },
      { name: "server", label: "Server" },
      { name: "e2e", label: "End-to-end" },
    ];
    const summary = document.getElementById("coverage-panel-summary");
    const knownStatuses = ["passed", "failed", "blocked", "unknown", "skipped"];

    const statusLabel = status =>
      ({
        passed: "Passing",
        failed: "Failing",
        blocked: "Blocked",
        unknown: "Incomplete",
        skipped: "Pending",
      })[status] || "Incomplete";

    const normalizeStatus = status =>
      knownStatuses.includes(status) ? status : "unknown";

    const escapeCoverageHtml = value =>
      String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const formatPercent = value =>
      typeof value === "number" ? `${value.toFixed(2)}%` : "n/a";

    const formatRecorded = isoString => {
      const date = new Date(isoString || "");

      if (Number.isNaN(date.getTime())) {
        return "";
      }

      const pad = value => String(value).padStart(2, "0");
      return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
        date.getUTCDate(),
      )} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
    };

    const formatDuration = durationMs => {
      if (typeof durationMs !== "number" || durationMs <= 0) {
        return "n/a";
      }

      const totalSeconds = Math.round(durationMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return minutes === 0 ? `${seconds}s` : `${minutes}m ${seconds}s`;
    };

    const resultPill = (label, value, passed) => `
      <span class="coverage-pill ${passed ? "coverage-pill-pass" : "coverage-pill-fail"}">
        ${escapeCoverageHtml(label)} <strong>${escapeCoverageHtml(value)}</strong>
      </span>
    `;

    const coverageResultHtml = lane => {
      if (!lane.metrics || Object.keys(lane.metrics).length === 0) {
        return "";
      }

      return ["statements", "branches", "functions", "lines"]
        .map(metric => {
          const values = lane.metrics[metric] || {};
          const label = metric.charAt(0).toUpperCase() + metric.slice(1);
          return resultPill(label, formatPercent(values.current), values.passed);
        })
        .join("");
    };

    const e2eResultHtml = lane => {
      const e2e = lane.e2eMetrics;

      if (!e2e) {
        return "";
      }

      const testValues = e2e.testValues || {};
      const areaValues = e2e.areaValues || {};
      const featureValues = e2e.featureValues || {};
      const scenarioValues = featureValues.scenarioCoverage || {};
      const parts = [];

      if (testValues.passed && testValues.total) {
        parts.push(
          resultPill(
            "Tests",
            `${testValues.passed.current}/${testValues.total.current}`,
            testValues.passed.passed && testValues.total.passed,
          ),
        );
      }

      if (testValues.passRate) {
        parts.push(
          resultPill(
            "Pass rate",
            formatPercent(testValues.passRate.current),
            testValues.passRate.passed,
          ),
        );
      }

      if (
        areaValues.areaCoverage &&
        typeof areaValues.areaCoverage.current === "number"
      ) {
        parts.push(
          resultPill(
            "Areas",
            `${e2e.exercisedAreaCount}/${e2e.definedAreaCount}`,
            areaValues.areaCoverage.passed,
          ),
        );
      }

      if (
        featureValues.featureCoverage &&
        typeof featureValues.featureCoverage.current === "number"
      ) {
        parts.push(
          resultPill(
            "Features",
            `${e2e.coveredFeatureCount}/${e2e.activeFeatureCount}`,
            featureValues.featureCoverage.passed,
          ),
        );
      }

      if (typeof scenarioValues.current === "number") {
        parts.push(
          resultPill(
            "Scenarios",
            `${e2e.coveredScenarioCount}/${e2e.requiredScenarioCount}`,
            scenarioValues.passed,
          ),
        );
      }

      parts.push(resultPill("Duration", formatDuration(e2e.durationMs), true));

      return parts.join("");
    };

    const setSuiteRow = lane => {
      const row = document.querySelector(
        `[data-coverage-suite="${lane.name}"]`,
      );

      if (!row) {
        return;
      }

      const status = row.querySelector(".coverage-status");
      status.className = `coverage-status coverage-status-${lane.status}`;
      status.textContent = statusLabel(lane.status);
      if (lane.message) {
        status.title = lane.message;
      }

      row.querySelector(".coverage-recorded").textContent = formatRecorded(
        lane.generatedAt,
      );

      const resultHtml =
        lane.kind === "test" ? e2eResultHtml(lane) : coverageResultHtml(lane);
      row.querySelector(".coverage-result").innerHTML =
        resultHtml ||
        `<span class="coverage-result-empty">${escapeCoverageHtml(
          lane.message || "No results recorded.",
        )}</span>`;

      row.querySelector(".coverage-report").innerHTML = lane.localReportHref
        ? `<a href="/coverage/${escapeCoverageHtml(lane.localReportHref)}">HTML</a>`
        : "—";
    };

    const overallStatus = lanes => {
      const active = lanes.filter(lane => lane.status !== "skipped");

      if (active.some(lane => lane.status === "failed")) {
        return "failing";
      }

      if (
        active.some(lane => lane.status === "blocked" || lane.status === "unknown")
      ) {
        return "incomplete";
      }

      if (active.length > 0 && active.every(lane => lane.status === "passed")) {
        return "passing";
      }

      return "pending";
    };

    const formatSummary = lanes => {
      const status = overallStatus(lanes);
      const formatList = items =>
        items.length <= 1
          ? items.join("")
          : items.length === 2
            ? `${items[0]} and ${items[1]}`
            : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
      const byStatus = lanes.reduce((result, lane) => {
        result[lane.status] = result[lane.status] || [];
        result[lane.status].push(lane.label);
        return result;
      }, {});

      if (status === "passing") {
        return {
          status: "passing",
          text: "All suites passing.",
        };
      }

      const parts = [];

      if (byStatus.failed) {
        parts.push(`${formatList(byStatus.failed)} failing`);
      }

      if (byStatus.blocked || byStatus.unknown) {
        parts.push(
          `${formatList([
            ...(byStatus.blocked || []),
            ...(byStatus.unknown || []),
          ])} incomplete`,
        );
      }

      if (byStatus.skipped) {
        parts.push(`${formatList(byStatus.skipped)} pending`);
      }

      return {
        status,
        text: parts.length
          ? `${parts.join("; ")}.`
          : "Coverage status is not available yet.",
      };
    };

    Promise.all(
      suites.map(async suite => {
        try {
          const response = await fetch(`/coverage/${suite.name}.json`, {
            cache: "no-store",
          });

          if (!response.ok) {
            throw new Error(`Coverage response ${response.status}`);
          }

          const lane = await response.json();
          return {
            ...lane,
            ...suite,
            status: normalizeStatus(lane.status),
            message: lane.message || "",
          };
        } catch (error) {
          return {
            ...suite,
            status: "unknown",
            message: "Coverage status is not available yet.",
          };
        }
      }),
    ).then(lanes => {
      const result = formatSummary(lanes);

      lanes.forEach(setSuiteRow);
      summary.className = `coverage-panel-summary coverage-summary-${result.status}`;
      summary.textContent = result.text;
    });
  })();
</script>
