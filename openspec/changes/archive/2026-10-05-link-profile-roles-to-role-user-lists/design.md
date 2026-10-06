# Design: Role links and addressable role lists

The admin user page will render the `welcome-team` role as the Greeter link and the `volunteer` role as the volunteer link. Each link targets the existing admin user search route with a `role` query parameter.

The admin search page will read a valid role query parameter on initial load and request the role-filtered list. Submitting another role filter will update the URL using browser history replacement, preserving a stable address without adding a history entry for each filter action. Pagination and sorting will keep the role query parameter.

The existing role-list API and its permission checks remain the source of the member data.

The main navigation will treat `welcome-team` as a limited admin-menu role and link directly to `/admin/acquisition-stories`, matching the existing welcome-team permission boundary. When a member has both `admin` and `welcome-team`, the link also goes directly to acquisition stories.

Contacts use a responsive grid, date or name ordering, and shared initials avatars that replace absent or failed image loads. Member search preserves indexed public-field context, emphasises literal matching tokens, and links the query back to map search. Hosting quick replies are hidden for empty and outgoing-only conversations.
