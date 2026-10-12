# Content Security Policy

Production scripts require an application origin, an explicitly listed analytics origin, or a fresh response nonce. Inline scripts without a nonce and JavaScript string evaluation are blocked. Object content is disabled. Blob workers remain available for the map renderer.

Deploy the normal production client bundle with the production server configuration. Development bundles use eval source maps and remain supported only by the development/test policy. Introducing a script provider requires reviewing and explicitly updating the policy; broad Twitter, Google and gstatic wildcard script origins are no longer permitted.

The server regression tests inspect production and development headers, including nonce rotation. Browser coverage exercises blocked inline scripts and rendered maps with production assets and the eval restriction applied.
