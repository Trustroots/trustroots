set shell := ["bash", "-cu"]

test-client:
    npm run test:client

test-server:
    npm run test:server:codex

test-e2e:
    npm run test:e2e

coverage-client:
    npm run test:coverage:client

coverage-server:
    npm run test:coverage:server:codex

coverage-report:
    #!/usr/bin/env bash
    set -euo pipefail

    open_report() {
      rm -f coverage-report/.server-url
      node -e '
      const fs = require("fs");
      const http = require("http");
      const path = require("path");

      const rootDir = path.resolve(".");
      const markerPath = path.join(rootDir, "coverage-report/.server-url");
      const contentTypes = {
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".png": "image/png",
      };

      const server = http.createServer((request, response) => {
        const url = new URL(request.url, "http://127.0.0.1");
        let pathname = decodeURIComponent(url.pathname);
        if (pathname === "/") {
          pathname = "/index.html";
        }

        const filePath = path.resolve(rootDir, `.${pathname}`);
        if (!filePath.startsWith(`${rootDir}${path.sep}`)) {
          response.writeHead(403);
          response.end("Forbidden");
          return;
        }

        fs.readFile(filePath, (error, contents) => {
          if (error) {
            response.writeHead(404);
            response.end("Not found");
            return;
          }

          response.writeHead(200, {
            "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
            "Cache-Control": "no-store",
          });
          response.end(contents);
        });
      });

      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        const url = `http://127.0.0.1:${address.port}/coverage-report/index.html`;
        fs.writeFileSync(markerPath, `${url}\n`);
      });
      ' &
      server_pid="$!"
      for _ in $(seq 1 50); do
        if [ -f coverage-report/.server-url ]; then
          break
        fi
        sleep 0.1
      done

      if [ ! -f coverage-report/.server-url ]; then
        echo "Open coverage-report/index.html in a browser."
        return 0
      fi

      report_url="$(< coverage-report/.server-url)"
      if command -v open >/dev/null 2>&1; then
        open "$report_url" && {
          echo "Coverage report is available at $report_url (server pid $server_pid)."
          return 0
        }
        open -a "Google Chrome" "$report_url" && {
          echo "Coverage report is available at $report_url (server pid $server_pid)."
          return 0
        }
        open -a Safari "$report_url" && {
          echo "Coverage report is available at $report_url (server pid $server_pid)."
          return 0
        }
      elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$report_url" && {
          echo "Coverage report is available at $report_url (server pid $server_pid)."
          return 0
        }
      fi

      echo "Open $report_url in a browser."
      return 0
    }

    npm run test:coverage:client
    npm run coverage:report -- --scope=client
    open_report
