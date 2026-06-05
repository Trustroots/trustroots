set shell := ["bash", "-cu"]

test-client:
    BROWSERSLIST_IGNORE_OLD_DATA=1 NODE_OPTIONS='--require ./jest/jest.hide-canvas.js' ./node_modules/.bin/jest --no-watchman --silent --maxWorkers=50%

test-server:
    npm run test:server:codex

test-e2e:
    npm run test:e2e

coverage-client:
    npm run test:coverage:client

coverage-server:
    npm run test:coverage:server:codex

# Serve coverage-report over HTTP so JSON loads without file:// CORS errors.
coverage-serve:
    #!/usr/bin/env bash
    set -euo pipefail

    report_url="http://127.0.0.1:1234/"

    if command -v open >/dev/null 2>&1; then
      open "$report_url" || open -a "Google Chrome" "$report_url" || open -a Safari "$report_url" || true
    elif command -v xdg-open >/dev/null 2>&1; then
      xdg-open "$report_url" || true
    fi

    if lsof -iTCP:1234 -sTCP:LISTEN >/dev/null 2>&1; then
      echo "Coverage report is available at $report_url (server already running)."
      exit 0
    fi

    echo "Coverage report: $report_url"
    python3 -m http.server 1234 --bind 127.0.0.1 --directory coverage-report

coverage-report:
    #!/usr/bin/env bash
    set -euo pipefail

    open_report() {
      report_url="http://127.0.0.1:1234/"
      server_pid=""

      if ! lsof -iTCP:1234 -sTCP:LISTEN >/dev/null 2>&1; then
        python3 -m http.server 1234 --bind 127.0.0.1 --directory coverage-report >/dev/null 2>&1 &
        server_pid="$!"
        sleep 0.2
      fi
      server_note=""
      if [ -n "$server_pid" ]; then
        server_note=" (server pid $server_pid)"
      fi

      if command -v open >/dev/null 2>&1; then
        open "$report_url" && {
          echo "Coverage report is available at $report_url$server_note."
          return 0
        }
        open -a "Google Chrome" "$report_url" && {
          echo "Coverage report is available at $report_url$server_note."
          return 0
        }
        open -a Safari "$report_url" && {
          echo "Coverage report is available at $report_url$server_note."
          return 0
        }
      elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$report_url" && {
          echo "Coverage report is available at $report_url$server_note."
          return 0
        }
      fi

      echo "Open $report_url in a browser$server_note."
      return 0
    }

    npm run test:coverage:client
    npm run coverage:report -- --scope=client
    open_report
