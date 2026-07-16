const fs = require('fs');
const path = require('path');
const vm = require('vm');
require('should');

const {
  renderReportShell,
} = require('../../../../../scripts/coverage/generate-report');

const analytics = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../../../docs/_data/analytics.json'),
    'utf8',
  ),
);
const teamLinks = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../../../docs/_data/team_links.json'),
    'utf8',
  ),
);

describe('Coverage report HTML', () => {
  const metadata = {
    branch: 'main',
    branchUrl: 'https://github.com/Trustroots/trustroots/tree/main',
    commit: '1234567890abcdef',
    commitUrl:
      'https://github.com/Trustroots/trustroots/commit/1234567890abcdef',
    generatedAtDisplay: '2026-07-05 12:00',
    isGitHubActions: true,
    runUrl: 'https://github.com/Trustroots/trustroots/actions/runs/1',
  };

  it('includes the team guide first-party Umami analytics script', () => {
    const html = renderReportShell(metadata, {});

    html.should.containEql(`src="${analytics.scriptSrc}"`);
    html.should.containEql(`data-website-id="${analytics.websiteId}"`);
  });

  it('renders team guide links from shared data', () => {
    const html = renderReportShell(metadata, {});

    teamLinks.header.forEach(link => {
      html.should.containEql(`<a href="${link.href}">${link.label}</a>`);
    });
    html.should.containEql(`href="${teamLinks.repository.href}"`);
  });

  it('sets intrinsic dimensions on GitHub icons for reader modes', () => {
    const html = renderReportShell(metadata, {});

    html.should.match(
      /class="github-icon"[\s\S]*?viewBox="0 0 16 16"[\s\S]*?width="16"[\s\S]*?height="16"/,
    );
  });

  it('emits parseable inline JavaScript', () => {
    const html = renderReportShell(metadata, {});
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];

    scripts.should.not.be.empty();
    scripts.forEach(scriptMatch => {
      const script = new vm.Script(scriptMatch[1]);
      script.should.be.ok();
    });
  });
});
