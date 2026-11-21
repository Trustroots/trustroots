## Decisions

Use the current organiser assignment for the authenticated viewer and return a viewer-specific edit capability with circle details. Include the organiser assignment in the write filter so revocation prevents subsequent updates. Validate the editable fields through the existing circle schema and preserve the slug.

Link web addresses at render time with the existing link parser and sanitiser so existing formatting and links still work.
