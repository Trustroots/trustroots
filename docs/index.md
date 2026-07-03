---
title: Trustroots Team Guide
---

## Volunteer

Help with the transition from platform to protocol: [nos.trustroots.org](https://nos.trustroots.org).

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
