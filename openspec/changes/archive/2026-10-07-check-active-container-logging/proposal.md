## Why

Deployment preflight checks the desired Compose logging driver but cannot detect
existing containers still using a remote driver. Changing Compose alone does not
change those containers, so replacement can still block on remote logging.

## What changes

- Require explicit positive local log-rotation limits in deployment configuration.
- Inspect existing application, worker and database containers before deployment
  or rollback; reject remote drivers and unbounded local logging.
- Document separate log-collector adoption and a repeatable outage rehearsal.

## Impact

Operators must migrate existing containers before using checked deployment. No
production configuration is changed automatically. Deployment regression tests
cover desired configuration, existing containers and inspection timeouts.
