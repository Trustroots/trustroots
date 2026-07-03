---
title: Trustroots Team Guide
---

## Volunteer

### Nostr — decentralized social networking

Trustroots is exploring how hospitality networks can rely less on individually run servers and administrative overhead. Nostr offers a promising path toward a more decentralized, gift-economy social web. One of the most helpful actions you can take is to try it out and provide feedback, negative or positive.

Learn more at [nos.trustroots.org](https://nos.trustroots.org).

### Technical help

Trustroots was in maintenance mode from 2022 till June 2026, development work is happening again and technical help is very welcome.

Useful areas include simplifying old code, upgrading dependencies, helping with the React transition, and connecting Trustroots with Nostr/Nostroots.

If you would like to contribute code, start with the [Trustroots repository](https://github.com/Trustroots/trustroots) and the current notes in the README.

## Recent activity

<section class="activity-panel" data-activity-panel>
  <div class="activity-panel-main">
    <div>
      <h3 id="activity-panel-title">Project activity</h3>
      <p id="activity-panel-summary">
        Loading recent issues, pull requests, and commits.
      </p>
    </div>
    <a class="activity-panel-link" href="https://github.com/Trustroots"
      >Open GitHub</a
    >
  </div>
  <div id="activity-list" class="activity-list" aria-live="polite">
    <p class="activity-empty">Loading recent activity.</p>
  </div>
</section>

<script>
  (() => {
    const repos = [
      { name: "Trustroots/trustroots", label: "Trustroots" },
      { name: "Trustroots/nostroots", label: "Nostroots" },
    ];
    const list = document.getElementById("activity-list");
    const summary = document.getElementById("activity-panel-summary");
    const limit = 8;

    const escapeHtml = value =>
      String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

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

    const fetchJson = async url => {
      const response = await fetch(url, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`GitHub response ${response.status}`);
      }

      return response.json();
    };

    const repoActivity = async repo => {
      const [issues, commits] = await Promise.all([
        fetchJson(
          `https://api.github.com/repos/${repo.name}/issues?state=open&sort=created&direction=desc&per_page=8`,
        ),
        fetchJson(`https://api.github.com/repos/${repo.name}/commits?per_page=8`),
      ]);

      return [
        ...issues.map(item => ({
          repo: repo.label,
          type: item.pull_request ? "PR" : "Issue",
          title: item.title,
          url: item.html_url,
          author: item.user && item.user.login,
          date: item.created_at,
        })),
        ...commits.map(item => ({
          repo: repo.label,
          type: "Commit",
          title: (item.commit.message || "").split("\n")[0],
          url: item.html_url,
          author:
            (item.author && item.author.login) ||
            (item.commit.author && item.commit.author.name),
          date: item.commit.author && item.commit.author.date,
        })),
      ];
    };

    const renderActivity = items => {
      const sorted = items
        .filter(item => item.date && item.title && item.url)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, limit);

      if (sorted.length === 0) {
        throw new Error("No recent activity found");
      }

      summary.textContent = `Showing ${sorted.length} recent updates across Trustroots and Nostroots.`;
      list.innerHTML = sorted
        .map(
          item => `
            <a class="activity-item" href="${escapeHtml(item.url)}">
              <span class="activity-meta">
                <span class="activity-badge">${escapeHtml(item.type)}</span>
                <span>${escapeHtml(item.repo)}</span>
                <span>${escapeHtml(relativeDate(item.date))}</span>
              </span>
              <span class="activity-title">${escapeHtml(item.title)}</span>
              ${
                item.author
                  ? `<span class="activity-author">by ${escapeHtml(item.author)}</span>`
                  : ""
              }
            </a>
          `,
        )
        .join("");
    };

    Promise.all(repos.map(repoActivity))
      .then(results => renderActivity(results.flat()))
      .catch(() => {
        summary.textContent = "Recent GitHub activity is temporarily unavailable.";
        list.innerHTML =
          '<p class="activity-empty">Open GitHub for the latest issues, pull requests, and commits.</p>';
      });
  })();
</script>

## Test coverage

<section class="coverage-panel" data-coverage-panel>
  <div class="coverage-panel-main">
    <div>
      <h3 id="coverage-panel-title">Coverage status</h3>
      <p id="coverage-panel-summary">Loading latest coverage status.</p>
    </div>
    <a class="coverage-panel-link" href="/coverage/">Open report</a>
  </div>
  <div class="coverage-suite-list" aria-label="Coverage suite statuses">
    <span class="coverage-suite" data-coverage-suite="client">
      <span class="coverage-suite-name">Client</span>
      <span class="coverage-status coverage-status-loading">Loading</span>
    </span>
    <span class="coverage-suite" data-coverage-suite="server">
      <span class="coverage-suite-name">Server</span>
      <span class="coverage-status coverage-status-loading">Loading</span>
    </span>
    <span class="coverage-suite" data-coverage-suite="e2e">
      <span class="coverage-suite-name">End-to-end</span>
      <span class="coverage-status coverage-status-loading">Loading</span>
    </span>
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

    const setSuiteStatus = lane => {
      const element = document.querySelector(
        `[data-coverage-suite="${lane.name}"] .coverage-status`,
      );

      if (!element) {
        return;
      }

      element.className = `coverage-status coverage-status-${lane.status}`;
      element.textContent = statusLabel(lane.status);
      if (lane.message) {
        element.title = lane.message;
      }
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
      const byStatus = lanes.reduce((result, lane) => {
        result[lane.status] = result[lane.status] || [];
        result[lane.status].push(lane.label);
        return result;
      }, {});
      const parts = [];

      if (byStatus.passed) {
        parts.push(`${byStatus.passed.join(" and ")} passing`);
      }

      if (byStatus.failed) {
        parts.push(`${byStatus.failed.join(" and ")} failing`);
      }

      if (byStatus.blocked || byStatus.unknown) {
        parts.push(
          `${[...(byStatus.blocked || []), ...(byStatus.unknown || [])].join(
            " and ",
          )} incomplete`,
        );
      }

      if (byStatus.skipped) {
        parts.push(`${byStatus.skipped.join(" and ")} pending`);
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

      lanes.forEach(setSuiteStatus);
      summary.className = `coverage-panel-summary coverage-summary-${result.status}`;
      summary.textContent = result.text;
    });
  })();
</script>
