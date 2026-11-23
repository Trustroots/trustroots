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

There are plenty of things to do. In June 2026 we went out of maintenance mode. Further down on this page you can see a bunch of actual tasks that people are working on. If you have tech skills it should be fairly easy to jump in and help out. If you don't have tech skills and you want to help there's still ways to do that, especially around testing.

If you don't have tech skills, [let us know](https://www.trustroots.org/support?category=volunteering) what you have in mind on how you think you can do to improve Trustroots?

Here are some ideas:

- communication
- help trustroots users to organize locally
- [welcoming new members](welcome.md) with practical advice for members and the team
- test the [Android app](/apps/)
- help support members through conflicts and contribute to community safety processes
- improve the [Trustroots Wiki](https://wiki.trustroots.org/) and connect it to the main site
  - for example, it would be cool to have circle descriptions directly on the wiki, so that all trustroots users will add information
  - develop ideas that are hidden in there, such as [Rural Hospitality](https://wiki.trustroots.org/en/Rural_hospitality)

<p><a class="volunteer-contact" href="https://www.trustroots.org/support?category=volunteering">Contact us if you want to help</a></p>

<hr>

### Decentralized social networking

The history of hospitality exchange is full of networks that failed their communities — sold to investors, abandoned, or dependent on a single person. In 2022, Trustroots nearly joined that list: only one volunteer had server access. We responded in two steps: first, we raised our [bus factor](https://en.wikipedia.org/wiki/Bus_factor) to 3 so at least three people can maintain the infrastructure; second, we asked how Trustroots could outlast any particular team of volunteers.

Federated models like Matrix or the Fediverse help, but they were not enough — they still tie your identity and data to specific servers and admins. We wanted deeper decentralisation, with users owning their own identity and data. We experimented with [Secure Scuttlebutt](https://en.wikipedia.org/wiki/Secure_Scuttlebutt), but it proved too impractical for everyday use; when Nostr looked viable, we started moving there instead. Read more in the [Nostroots background](https://nos.trustroots.org/background/).

### Nostroots

Trustroots is exploring how hospitality networks can rely less on individually run servers and administrative overhead. Nostr offers a promising path toward a more decentralised, gift-economy social web. One of the most helpful actions you can take is to try it out and provide [feedback](https://www.trustroots.org/support).

Try it out at [nos.trustroots.org](https://nos.trustroots.org).

## Technical help

Useful areas include testing, simplifying old code, upgrading dependencies, helping with finishing the transition to React, and connecting Trustroots with Nostroots.

Check what's been going on recently, your help is very welcome:

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
          const author = item.author || "";
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
