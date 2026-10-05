# Design

The circle page calls one authenticated `GET /api/tribes/:tribe/members` endpoint after the signed-in member opens a circle they joined. The endpoint returns `contacts`, `recommenders`, and `active` arrays of the existing restricted mini-profile shape. The browser does not fan out profile requests.

Contact and public positive-experience aggregations filter circle membership, public profile visibility, restricted roles, and both directions of blocking before applying their 20-member limits. The recent-activity query applies the same filters, excludes IDs returned in earlier groups, selects members seen within the preceding month, sorts by `seen`, and returns up to eight. Every discovery query has a one-second MongoDB execution limit; response fields omit `seen`.

The recent-activity query uses a compound `member.tribe`, `seen`, `_id` index. The experience aggregation uses a `userTo`, `public`, `recommend`, `created` index. Deployments with automatic index creation disabled must run `npm run ensure-circle-discovery-indexes` before rolling out the endpoint. This maintenance command creates only the two named circle discovery indexes and does not synchronise or drop other indexes.

The web page renders the returned summaries through the existing `Avatar` and `UserLink` components. The hero actions wrap on narrow viewports, and circle detail pages reuse the shared footer with its standard links and current build metadata.
